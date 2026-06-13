import { readFileSync } from 'fs'
import { join } from 'path'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'

const EFFORTS = [
  { key: '1k', label: '1K', km: 1 },
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

function loadOfficialPbs(): Map<string, { seconds: number; activityId: string | null }> {
  const map = new Map<string, { seconds: number; activityId: string | null }>()
  try {
    const raw = readFileSync(join(process.cwd(), 'public/pbs.json'), 'utf-8')
    const data: { year: number; entries: { distance: string; seconds: number; activityId?: string }[] }[] =
      JSON.parse(raw)
    for (const year of data) {
      for (const entry of year.entries) {
        const key = DISTANCE_KEY[entry.distance]
        if (!key) continue
        const existing = map.get(key)
        if (!existing || entry.seconds < existing.seconds) {
          map.set(key, { seconds: entry.seconds, activityId: entry.activityId ?? null })
        }
      }
    }
  } catch {
    // pbs.json missing or invalid
  }
  return map
}

export interface RecordEntry {
  key: string
  label: string
  seconds: number | null
  paceSecPerKm: number | null
  activityId: string | null
  date: string | null
  official: boolean
}

export function getRecords(): RecordEntry[] {
  const activities = getAllActivities()
  const officialPbs = loadOfficialPbs()

  return EFFORTS.map(({ key, label, km }) => {
    const official = officialPbs.get(key)
    if (official) {
      return {
        key,
        label,
        seconds: official.seconds,
        paceSecPerKm: Math.round(official.seconds / km),
        activityId: official.activityId,
        date: null,
        official: true,
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
    }
  })
}
