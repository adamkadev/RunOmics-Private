import type { Activity } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getPbsFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'

export const EFFORTS = [
  { key: '1k',       label: '1K',       km: 1        },
  { key: '1mile',    label: '1 Mile',   km: 1.60934  },
  { key: '5k',       label: '5K',       km: 5        },
  { key: '10k',      label: '10K',      km: 10       },
  { key: 'half',     label: 'Half',     km: 21.0975  },
  { key: 'marathon', label: 'Marathon', km: 42.195   },
]

const DISTANCE_KEY: Record<string, string> = {
  '1K': '1k',
  '5K': '5k',
  '10K': '10k',
  'Half-Marathon': 'half',
  'Marathon': 'marathon',
}

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
  const pbYears = await getPbsFromFirestore()
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
        label: 'Longest Run',
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
        label: 'Longest Run',
        seconds: null,
        paceSecPerKm: null,
        activityId: null,
        date: null,
        official: false,
      }

  return [...effortRecords, longestRecord]
}

export function getPrLabelsByActivityId(records: RecordEntry[]): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const r of records) {
    if (!r.activityId) continue
    result[r.activityId] = [...(result[r.activityId] ?? []), r.label]
  }
  return result
}

export function getTopEfforts(n = 5): TopEfforts {
  const activities = getAllActivities()
  const result: TopEfforts = {}

  for (const { key, km } of EFFORTS) {
    const entries = activities
      .filter((a) => a.bestEfforts?.[key] != null)
      .map((a) => ({
        seconds: Math.round(a.bestEfforts![key]),
        distanceKm: km,
        activityId: a.id,
        date: a.date,
        eventName: a.description || undefined,
      }))
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
