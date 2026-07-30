import type { Activity } from './types'
import { EFFORTS } from './effort'

const DAY_MS = 86_400_000

// A baseline is the athlete's own recent form at this session type: enough runs
// to average out a bad day, close enough in time to still describe them.
const BASELINE_LOOKBACK_DAYS = 90
const BASELINE_RUNS = 5
const BASELINE_MIN_RUNS = 3

// Below this, "your best since..." is last month's run, which the athlete
// remembers perfectly well without being told.
const STANDING_MIN_DAYS = 60

const HARD_ZONE = 4

export interface TypeBaseline {
  runs: number
  paceSecPerKm: number
  avgHr: number | null
}

export interface EffortStanding {
  label: string
  /** Days since a run went faster over this distance; null when none ever did. */
  daysSinceBetter: number | null
}

/**
 * What the athlete's own past says about one run. Every read looks strictly
 * backwards, so a verdict stays true forever: a faster run next month cannot
 * turn today's copy into a lie, and the cached insight never has to be redone.
 */
export interface RunHistory {
  baseline: TypeBaseline | null
  standing: EffortStanding | null
  /** Minutes spent in zone 4 or 5 - the part of the session that was actually hard. */
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

function effortStanding(activity: Activity, before: Activity[], day: number): EffortStanding | null {
  // Longest distance first, so a stable sort keeps the 10K story ahead of the
  // 1K one that is buried inside it.
  const candidates = [...EFFORTS]
    .reverse()
    .flatMap(({ key, label }) => {
      const seconds = activity.bestEfforts?.[key]
      if (seconds == null) return []
      // Nothing to stand against: the first ever run over that distance is a
      // fact about the dataset, not about the athlete.
      if (!before.some((a) => a.bestEfforts?.[key] != null)) return []

      const better = before.find((a) => (a.bestEfforts?.[key] ?? Infinity) < seconds)
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

export function runHistory(activity: Activity, activities: Activity[]): RunHistory {
  const day = dayNumber(activity.date)
  const before = activities
    .filter((a) => a.id !== activity.id && dayNumber(a.date) <= day)
    .sort((a, b) => b.date.localeCompare(a.date))
  const last = before[0]

  return {
    baseline: typeBaseline(activity, before, day),
    standing: effortStanding(activity, before, day),
    hardMinutes: hardMinutes(activity),
    runsInPast7Days: before.filter((a) => day - dayNumber(a.date) < 7).length + 1,
    daysSinceLastRun: last ? day - dayNumber(last.date) : null,
  }
}
