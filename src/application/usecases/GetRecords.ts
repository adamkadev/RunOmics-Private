import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

const EFFORTS = [
  { key: '1k', label: '1K', km: 1 },
  { key: '5k', label: '5K', km: 5 },
  { key: '10k', label: '10K', km: 10 },
  { key: 'half', label: 'Half', km: 21.0975 },
  { key: 'marathon', label: 'Marathon', km: 42.195 },
]

export interface RecordEntry {
  key: string
  label: string
  seconds: number | null
  paceSecPerKm: number | null
  activityId: string | null
  date: string | null
}

export function getRecords(): RecordEntry[] {
  const activities = getAllActivities()

  return EFFORTS.map(({ key, label, km }) => {
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
    }
  })
}
