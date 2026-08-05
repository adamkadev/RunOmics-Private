import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getPbYears } from '@/infrastructure/repositories/JsonPbRepository'
import { EFFORTS, DISTANCE_KEY } from '@/domain/activity/effort'
import { t } from '@/i18n'

// Pure (no fs dependency) - re-exported here for existing importers, but client
// components should import from the domain module directly so they don't pull
// this file's server-only fs import into the browser bundle.
export { EFFORTS, DISTANCE_KEY }

export interface RecordEntry {
  key: string
  label: string
  seconds: number | null
  paceSecPerKm: number | null
  distanceKm?: number
  activityId: string | null
  date: string | null
  official: boolean
  eventName?: string
}

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

export function computeBestEfforts(activities: Activity[]): Map<string, BestEffort> {
  const best = new Map<string, BestEffort>()
  for (const { key } of EFFORTS) {
    let entry: BestEffort | null = null
    for (const a of activities) {
      const sec = a.bestEfforts?.[key]
      if (sec != null && (entry === null || sec < entry.seconds)) {
        entry = { seconds: sec, activityId: a.id, date: a.date, description: a.description }
      }
    }
    if (entry) best.set(key, entry)
  }
  return best
}

export async function getRecords(): Promise<RecordEntry[]> {
  const activities = getAllActivities()
  const pbYears = getPbYears()
  const activityMap = new Map(activities.map((a) => [a.id, a]))
  const computed = computeBestEfforts(activities)

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
    if (official) {
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

    const best = computed.get(key) ?? null
    return {
      key,
      label,
      seconds: best ? Math.round(best.seconds) : null,
      paceSecPerKm: best ? Math.round(best.seconds / km) : null,
      activityId: best?.activityId ?? null,
      date: best?.date ?? null,
      official: false,
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

export function getMostRecentRecord(records: RecordEntry[]): RecordEntry | null {
  const withDate = records.filter((r) => r.date !== null)
  if (withDate.length === 0) return null
  return withDate.reduce((latest, r) => (r.date! > latest.date! ? r : latest))
}

export interface QualifiedEffort {
  key: string
  label: string
  /** 1 = the current all-time record for this distance; 2/3 = next-best all-time. */
  rank: number
}

/**
 * Every activity that ranks in the top `topN` all-time for at least one
 * distance, grouped by activityId. Rank 1 comes from `records` (which is
 * official-PB-aware); ranks 2..topN come from the locally-recorded
 * leaderboard (`getTopEfforts`), skipping whichever activity already holds
 * rank 1 for that distance so it isn't double-labeled.
 */
export function getQualifiedEffortsByActivityId(
  records: RecordEntry[],
  activities: Activity[] = getAllActivities(),
  topN = 3,
): Record<string, QualifiedEffort[]> {
  const result: Record<string, QualifiedEffort[]> = {}
  const push = (activityId: string, entry: QualifiedEffort) => {
    result[activityId] = [...(result[activityId] ?? []), entry]
  }

  const rank1ActivityByKey = new Map<string, string>()
  for (const r of records) {
    if (!r.activityId) continue
    rank1ActivityByKey.set(r.key, r.activityId)
    push(r.activityId, { key: r.key, label: r.label, rank: 1 })
  }

  const topEfforts = getTopEfforts(activities, topN)
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

export function getTopEfforts(activities: Activity[] = getAllActivities(), n = 5): TopEfforts {
  const result: TopEfforts = {}

  for (const { key, km } of EFFORTS) {
    const entries = activities
      .flatMap((a) => {
        const seconds = a.bestEfforts?.[key]
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
