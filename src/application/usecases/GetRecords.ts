import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { getOfficialRaceResults } from '@/infrastructure/repositories/JsonRaceResultRepository'
import { creditedEffortSeconds, matchesEffortDistance, officialResultsByActivityId, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { EFFORTS, DISTANCE_KEY } from '@/domain/activity/effort'
import { t } from '@/i18n'
import type { RecordEntry, RunRecord } from '@/domain/race/records'
import type { PbYear } from '@/domain/goals/types'

export type { RecordEntry, RunRecord } from '@/domain/race/records'

export { EFFORTS, DISTANCE_KEY }

export interface TopEffortEntry {
  seconds: number
  distanceKm: number
  activityId: string
  date: string
  eventName?: string
}

export type TopEfforts = Record<string, TopEffortEntry[]>

export interface BestEffort {
  seconds: number
  activityId: string
  date: string
  description: string
}

export function computeBestEfforts(
  activities: Activity[],
  officialResults: OfficialRaceResult[] = getOfficialRaceResults(),
): Map<string, BestEffort> {
  const officialByActivityId = officialResultsByActivityId(officialResults)
  const best = new Map<string, BestEffort>()
  for (const { key, km } of EFFORTS) {
    let entry: BestEffort | null = null
    for (const a of activities) {
      const sec = creditedEffortSeconds(a, key, km, officialByActivityId)
      if (sec != null && (entry === null || sec < entry.seconds)) {
        entry = { seconds: sec, activityId: a.id, date: a.date, description: a.description }
      }
    }
    if (entry) best.set(key, entry)
  }
  return best
}

// By the activity list, the same array until the data changes: the records are worked out once per data, not per render.
const recordsCache = new WeakMap<Activity[], RecordEntry[]>()

/** Shared between callers: read it, never change it. */
export async function getRecords(): Promise<RecordEntry[]> {
  const activities = getAllActivities()
  let records = recordsCache.get(activities)
  if (!records) recordsCache.set(activities, (records = computeRecords(activities)))
  return records
}

export function computeRecords(
  activities: Activity[],
  pbYears: PbYear[] = getPbYears(),
  officialResults: OfficialRaceResult[] = getOfficialRaceResults(),
): RecordEntry[] {
  const activityMap = new Map(activities.map((a) => [a.id, a]))
  const computed = computeBestEfforts(activities, officialResults)
  const officialByActivityId = officialResultsByActivityId(officialResults)

  const officialPbs = new Map<string, { seconds: number; activityId: string | null }>()
  for (const year of pbYears) {
    for (const entry of year.entries) {
      const key = DISTANCE_KEY[entry.distance]
      if (!key) continue
      const existing = officialPbs.get(key)
      if (!existing || entry.seconds < existing.seconds) {
        officialPbs.set(key, { seconds: entry.seconds, activityId: entry.activityId ?? null })
      }
    }
  }

  const effortRecords: RecordEntry[] = EFFORTS.map(({ key, label, km }) => {
    const official = officialPbs.get(key)
    const best = computed.get(key) ?? null
    // A chip time is trusted over a GPS effort only until a run beats it.
    if (official && !(best && Math.round(best.seconds) < official.seconds)) {
      const activity = official.activityId ? activityMap.get(official.activityId) : undefined
      const date = activity?.date ?? null
      return {
        key,
        label,
        seconds: official.seconds,
        paceSecPerKm: Math.round(official.seconds / km),
        activityId: official.activityId,
        date,
        official: true,
        eventName: activity?.description || undefined,
      }
    }

    // The winning effort can itself be official: creditedEffortSeconds credits
    // chip times into the computed set.
    const bestResult = best?.activityId ? officialByActivityId.get(best.activityId) : undefined
    return {
      key,
      label,
      seconds: best ? Math.round(best.seconds) : null,
      paceSecPerKm: best ? Math.round(best.seconds / km) : null,
      activityId: best?.activityId ?? null,
      date: best?.date ?? null,
      official: !!bestResult && matchesEffortDistance(bestResult, km),
      eventName: best?.description || undefined,
    }
  })

  const longestActivity = activities
    .filter((a) => a.distanceKm > 0)
    .reduce<(typeof activities)[0] | null>(
      (best, a) => (best === null || a.distanceKm > best.distanceKm ? a : best),
      null
    )

  const longestRecord: RecordEntry = longestActivity
    ? {
        key: 'longest',
        label: t.records.distances.longest!,
        seconds: longestActivity.durationSeconds,
        paceSecPerKm: longestActivity.paceSecPerKm ?? Math.round(longestActivity.durationSeconds / longestActivity.distanceKm),
        distanceKm: longestActivity.distanceKm,
        activityId: longestActivity.id,
        date: longestActivity.date,
        official: false,
        eventName: longestActivity.description || undefined,
      }
    : {
        key: 'longest',
        label: t.records.distances.longest!,
        seconds: null,
        paceSecPerKm: null,
        activityId: null,
        date: null,
        official: false,
      }

  return [...effortRecords, longestRecord]
}

/** Whole 30 s marks up to a mile ("sub-3:30"), whole 5 min beyond it ("sub-20", "sub-1:40"). */
function markStep(km: number): number {
  return km < 2 ? 30 : 300
}

/** The longest distance the run holds the record over, against the best before it. */
export function runRecord(
  activity: Pick<Activity, 'id' | 'date'>,
  records: RecordEntry[],
  activities: Activity[] = getAllActivities(),
  pbYears: PbYear[] = getPbYears(),
  officialResults: OfficialRaceResult[] = getOfficialRaceResults(),
): RunRecord | null {
  const held = EFFORTS.filter(({ key }) => records.some((r) => r.key === key && r.activityId === activity.id && r.seconds !== null))
  const effort = held.at(-1)
  if (!effort) return null
  const seconds = records.find((r) => r.key === effort.key)!.seconds!
  const before = activities.filter((a) => a.date < activity.date)
  const ids = new Set(before.map((a) => a.id))
  const earlierPbs = pbYears.map((year) => ({ ...year, entries: year.entries.filter((entry) => ids.has(entry.activityId)) }))
  const previousSeconds = computeRecords(before, earlierPbs, officialResults).find((r) => r.key === effort.key)?.seconds ?? null
  const step = markStep(effort.km)
  const mark = Math.ceil(seconds / step) * step
  return {
    key: effort.key,
    seconds,
    previousSeconds,
    milestoneSeconds: previousSeconds !== null && previousSeconds >= mark && seconds < mark ? mark : null,
  }
}

export function getMostRecentRecord(records: RecordEntry[]): RecordEntry | null {
  const withDate = records.filter((r) => r.date !== null)
  if (withDate.length === 0) return null
  return withDate.reduce((latest, r) => (r.date! > latest.date! ? r : latest))
}

export interface QualifiedEffort {
  key: string
  label: string
  rank: number
}

export function getQualifiedEffortsByActivityId(
  records: RecordEntry[],
  activities: Activity[] = getAllActivities(),
  topN = 3,
  officialResults: OfficialRaceResult[] = getOfficialRaceResults(),
): Record<string, QualifiedEffort[]> {
  const result: Record<string, QualifiedEffort[]> = {}
  const push = (activityId: string, entry: QualifiedEffort) => {
    result[activityId] = [...(result[activityId] ?? []), entry]
  }

  const rank1ActivityByKey = new Map<string, string>()
  for (const r of records) {
    if (!r.activityId) continue
    rank1ActivityByKey.set(r.key, r.activityId)
    if (r.official) continue
    push(r.activityId, { key: r.key, label: r.label, rank: 1 })
  }

  const topEfforts = getTopEfforts(activities, topN, officialResults)
  for (const { key, label } of EFFORTS) {
    const officialActivityId = rank1ActivityByKey.get(key)
    for (const [i, entry] of (topEfforts[key] ?? []).entries()) {
      const rank = i + 1
      if (rank > topN || entry.activityId === officialActivityId) continue
      push(entry.activityId, { key, label, rank })
    }
  }

  return result
}

export function getTopEfforts(
  activities: Activity[] = getAllActivities(),
  n = 5,
  officialResults: OfficialRaceResult[] = getOfficialRaceResults(),
): TopEfforts {
  const result: TopEfforts = {}
  const officialByActivityId = officialResultsByActivityId(officialResults)

  for (const { key, km } of EFFORTS) {
    const entries = activities
      .flatMap((a) => {
        const seconds = creditedEffortSeconds(a, key, km, officialByActivityId)
        if (seconds == null) return []
        return [{
          seconds: Math.round(seconds),
          distanceKm: km,
          activityId: a.id,
          date: a.date,
          eventName: a.description || undefined,
        }]
      })
      .sort((a, b) => a.seconds - b.seconds)
      .slice(0, n)
    if (entries.length) result[key] = entries
  }

  const longest = activities
    .filter((a) => a.distanceKm > 0)
    .sort((a, b) => b.distanceKm - a.distanceKm)
    .slice(0, n)
    .map((a) => ({
      seconds: a.durationSeconds,
      distanceKm: a.distanceKm,
      activityId: a.id,
      date: a.date,
      eventName: a.description || undefined,
    }))
  if (longest.length) result['longest'] = longest

  return result
}
