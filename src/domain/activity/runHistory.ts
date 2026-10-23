import { DAY_MS } from '@/lib/calendarDate'
import type { Activity } from './types'
import { EFFORTS } from './effort'
import { isLongSession } from './longRun'
import { repStats, type RepStats } from './sessionExecution'
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
  measure: 'runs' | 'reps'
}

export interface EffortStanding {
  label: string
  daysSinceBetter: number | null
}

export interface PreviousRun {
  type: Activity['type']
  description: string
  daysAgo: number
}

/** Rep for rep: a threshold block progresses session to session, which an average of the last five blurs. */
export interface PreviousSession extends RepStats {
  daysAgo: number
}

/** Races are left out: a half marathon raced in May is no long run to measure an easy Sunday against. */
export interface LongestRun {
  km: number
  daysAgo: number
  daysSinceAsLong: number | null
}

export interface RunHistory {
  baseline: TypeBaseline | null
  standing: EffortStanding | null
  hardMinutes: number | null
  runsInPast7Days: number
  daysSinceLastRun: number | null
  previous: PreviousRun | null
  previousSession: PreviousSession | null
  longest: LongestRun | null
}

function dayNumber(date: string): number {
  return Math.floor(new Date(date.slice(0, 10) + 'T00:00:00Z').getTime() / DAY_MS)
}

/** A 7-minute threshold rep compares from one session to the next; a 400 m and a 1 km VO2max rep do not. */
const REP_BASELINE_TYPES: ReadonlySet<Activity['type']> = new Set(['Tempo', 'Threshold'])

function recentPeers(activity: Activity, before: Activity[], day: number, alike: (a: Activity) => boolean): Activity[] {
  return before
    .filter((a) => a.type === activity.type && a.distanceKm > 0 && day - dayNumber(a.date) <= BASELINE_LOOKBACK_DAYS && alike(a))
    .slice(0, BASELINE_RUNS)
}

/** Threshold reps, not whole-run averages the warm-up and recoveries dilute; no average for a race, whose peers are other distances. */
function typeBaseline(activity: Activity, before: Activity[], day: number): TypeBaseline | null {
  if (activity.type === 'Race') return null

  if (REP_BASELINE_TYPES.has(activity.type) && repStats(activity)) {
    const reps = recentPeers(activity, before, day, (a) => repStats(a) !== null).map((a) => repStats(a)!)
    if (reps.length < BASELINE_MIN_RUNS) return null
    const heartRates = reps.map((r) => r.avgHr).filter((hr): hr is number => hr !== null)
    return {
      runs: reps.length,
      paceSecPerKm: Math.round(reps.reduce((sum, r) => sum + r.paceSecPerKm, 0) / reps.length),
      avgHr: heartRates.length ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length) : null,
      measure: 'reps',
    }
  }

  const long = isLongSession(activity)
  const peers = recentPeers(activity, before, day, (a) => activity.type !== 'Base' || isLongSession(a) === long)
  if (peers.length < BASELINE_MIN_RUNS) return null

  const seconds = peers.reduce((sum, a) => sum + a.durationSeconds, 0)
  const km = peers.reduce((sum, a) => sum + a.distanceKm, 0)
  const heartRates = peers.map((a) => a.avgHeartRate).filter((hr): hr is number => hr !== null)

  return {
    runs: peers.length,
    paceSecPerKm: Math.round(seconds / km),
    avgHr: heartRates.length ? Math.round(heartRates.reduce((sum, hr) => sum + hr, 0) / heartRates.length) : null,
    measure: 'runs',
  }
}

const SESSION_TYPES: ReadonlySet<Activity['type']> = new Set(['Tempo', 'Threshold', 'VO2Max', 'Anaerobic', 'Sprint'])

function previousSession(activity: Activity, before: Activity[], day: number): PreviousSession | null {
  if (!SESSION_TYPES.has(activity.type) || !repStats(activity)) return null
  const last = recentPeers(activity, before, day, (a) => repStats(a) !== null)[0]
  return last ? { ...repStats(last)!, daysAgo: day - dayNumber(last.date) } : null
}

function longestRun(activity: Activity, before: Activity[], day: number): LongestRun | null {
  const runs = before.filter((a) => a.type !== 'Race')
  const recent = runs.filter((a) => day - dayNumber(a.date) <= BASELINE_LOOKBACK_DAYS && a.distanceKm > 0)
  const longest = recent.reduce<Activity | null>((max, a) => (!max || a.distanceKm > max.distanceKm ? a : max), null)
  if (!longest) return null
  const asLong = runs.find((a) => a.distanceKm >= activity.distanceKm)
  return {
    km: Math.round(longest.distanceKm * 10) / 10,
    daysAgo: day - dayNumber(longest.date),
    daysSinceAsLong: asLong ? day - dayNumber(asLong.date) : null,
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
    previous: last ? { type: last.type, description: last.description ?? '', daysAgo: day - dayNumber(last.date) } : null,
    previousSession: previousSession(activity, before, day),
    longest: longestRun(activity, before, day),
  }
}
