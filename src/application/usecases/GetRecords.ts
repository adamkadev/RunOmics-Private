import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getPbsFromFirestore } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { getFullLoadHistory } from './GetTrainingLoad'
import type { LoadSnapshot } from './GetTrainingLoad'

const EFFORTS = [
  //{ key: '1k', label: '1K', km: 1 },
  { key: '5k', label: '5K', km: 5 },
  { key: '10k', label: '10K', km: 10 },
  { key: 'half', label: 'Half', km: 21.0975 },
  { key: 'marathon', label: 'Marathon', km: 42.195 },
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
  activityId: string | null
  date: string | null
  official: boolean
  formAtPb: LoadSnapshot | null
}

export async function getRecords(): Promise<RecordEntry[]> {
  const activities = getAllActivities()
  const pbYears = await getPbsFromFirestore()
  const activityMap = new Map(activities.map((a) => [a.id, a]))
  const loadHistory = getFullLoadHistory()

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

  return EFFORTS.map(({ key, label, km }) => {
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
        formAtPb: date ? (loadHistory.get(date) ?? null) : null,
      }
    }

    let best: { seconds: number; activityId: string; date: string } | null = null
    for (const a of activities) {
      const sec = a.bestEfforts?.[key]
      if (sec != null && (best === null || sec < best.seconds)) {
        best = { seconds: sec, activityId: a.id, date: a.date }
      }
    }
    return {
      key,
      label,
      seconds: best ? Math.round(best.seconds) : null,
      paceSecPerKm: best ? Math.round(best.seconds / km) : null,
      activityId: best?.activityId ?? null,
      date: best?.date ?? null,
      official: false,
      formAtPb: best?.date ? (loadHistory.get(best.date) ?? null) : null,
    }
  })
}
