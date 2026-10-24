import { round } from '@/lib/math'
import { ACTIVITY_TYPES, type Activity, type HrZone } from './types'

/** A warm-up, a test and a cool-down the watch saved apart start within minutes of each other's end. */
const SESSION_GAP_SECONDS = 30 * 60

function secondOfDay(activity: Activity): number | null {
  const time = activity.startTimeLocal?.match(/T(\d{2}):(\d{2}):(\d{2})/)
  return time ? Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) : null
}

function backToBack(previous: Activity, next: Activity): boolean {
  const previousStart = secondOfDay(previous)
  const nextStart = secondOfDay(next)
  if (previous.date !== next.date || previousStart === null || nextStart === null) return false
  return nextStart - (previousStart + previous.durationSeconds) <= SESSION_GAP_SECONDS
}

/** A run synced before start times were stored cannot be placed, so it stands alone. */
export function groupSessions(activities: readonly Activity[]): Activity[][] {
  const ordered = [...activities].sort((a, b) =>
    a.date.localeCompare(b.date) || (a.startTimeLocal ?? '').localeCompare(b.startTimeLocal ?? ''))
  const sessions: Activity[][] = []
  for (const activity of ordered) {
    const session = sessions.at(-1)
    const previous = session?.at(-1)
    if (session && previous && backToBack(previous, activity)) session.push(activity)
    else sessions.push([activity])
  }
  return sessions
}

const effortRank = (activity: Activity): number => activity.type === 'Race' ? -1 : ACTIVITY_TYPES.indexOf(activity.type)

export function mainPart<T extends Activity>(parts: readonly T[]): T {
  return parts.reduce((best, part) => {
    const rank = effortRank(part) - effortRank(best)
    return rank < 0 || (rank === 0 && part.durationSeconds > best.durationSeconds) ? part : best
  })
}

function total(parts: readonly Activity[], value: (part: Activity) => number | null, decimals: number): number | null {
  const known = parts.map(value).filter((v): v is number => v !== null)
  return known.length ? round(known.reduce((sum, v) => sum + v, 0), decimals) : null
}

function timeWeighted(parts: readonly Activity[], value: (part: Activity) => number | null, decimals: number): number | null {
  const known = parts.flatMap((part) => {
    const v = value(part)
    return v === null || part.durationSeconds <= 0 ? [] : [{ v, seconds: part.durationSeconds }]
  })
  const seconds = known.reduce((sum, item) => sum + item.seconds, 0)
  return seconds ? round(known.reduce((sum, item) => sum + item.v * item.seconds, 0) / seconds, decimals) : null
}

function mergedZones(parts: readonly Activity[]): HrZone[] {
  const byZone = new Map<number, HrZone>()
  for (const zone of parts.flatMap((part) => part.hrZones)) {
    const known = byZone.get(zone.zone)
    byZone.set(zone.zone, known ? { ...known, seconds: known.seconds + zone.seconds } : { ...zone })
  }
  const zones = [...byZone.values()].sort((a, b) => a.zone - b.zone)
  const seconds = zones.reduce((sum, zone) => sum + zone.seconds, 0)
  return zones.map((zone) => ({ ...zone, percent: seconds ? round((zone.seconds / seconds) * 100, 1) : 0 }))
}

function fastestEfforts(parts: readonly Activity[]): Record<string, number> | null {
  const efforts: Record<string, number> = {}
  for (const [key, seconds] of parts.flatMap((part) => Object.entries(part.bestEfforts ?? {}))) {
    if (efforts[key] === undefined || seconds < efforts[key]) efforts[key] = seconds
  }
  return Object.keys(efforts).length ? efforts : null
}

export function mergeSession(parts: readonly Activity[]): Activity {
  const main = mainPart(parts)
  if (parts.length === 1) return main
  const durationSeconds = parts.reduce((sum, part) => sum + part.durationSeconds, 0)
  const distanceKm = round(parts.reduce((sum, part) => sum + part.distanceKm, 0), 2)
  const rpes = parts.map((part) => part.rpe).filter((rpe): rpe is number => rpe !== null)
  return {
    ...main,
    startTimeLocal: parts[0]!.startTimeLocal,
    durationSeconds,
    distanceKm,
    paceSecPerKm: distanceKm > 0 ? round(durationSeconds / distanceKm, 1) : null,
    hrZones: mergedZones(parts),
    avgHeartRate: timeWeighted(parts, (part) => part.avgHeartRate, 0),
    rpe: rpes.length ? Math.max(...rpes) : null,
    elevationGain: total(parts, (part) => part.elevationGain, 1),
    calories: total(parts, (part) => part.calories, 0),
    cadenceSpm: timeWeighted(parts, (part) => part.cadenceSpm, 1),
    groundContactMs: timeWeighted(parts, (part) => part.groundContactMs, 1),
    verticalOscillationMm: timeWeighted(parts, (part) => part.verticalOscillationMm, 1),
    verticalRatioPct: timeWeighted(parts, (part) => part.verticalRatioPct, 2),
    strideLengthM: timeWeighted(parts, (part) => part.strideLengthM, 2),
    bestEfforts: fastestEfforts(parts),
  }
}
