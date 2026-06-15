import { readFileSync } from 'fs'
import { join } from 'path'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getFullLoadHistory } from './GetTrainingLoad'
import type { LoadSnapshot } from './GetTrainingLoad'
import { getLatestVO2max } from './GetVO2maxHistory'
import { round } from '@/lib/math'

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
  formAtPb: LoadSnapshot | null
  prediction: number | null  // predicted seconds based on current VO2max
}

// Jack Daniels VO2 demand at velocity v (m/min) - used for pace prediction only
function jackDanielsVO2(seconds: number, distanceM: number): number {
  const v = (distanceM / seconds) * 60
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  const t = seconds / 60
  const pct =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)
  return round(vo2 / pct)
}

function predictRaceTime(vo2max: number, distanceM: number): number {
  // Binary search: jackDanielsVO2 is decreasing in T - find T where it equals vo2max
  let lo = distanceM / 10   // ~10 m/s, absurdly fast
  let hi = distanceM / 1.5  // ~1.5 m/s, very slow
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (jackDanielsVO2(mid, distanceM) > vo2max) lo = mid
    else hi = mid
  }
  return Math.round((lo + hi) / 2)
}

export function getRecords(): RecordEntry[] {
  const activities = getAllActivities()
  const officialPbs = loadOfficialPbs()
  const activityMap = new Map(activities.map((a) => [a.id, a]))
  const loadHistory = getFullLoadHistory()
  const vo2max = getLatestVO2max()

  return EFFORTS.map(({ key, label, km }) => {
    const prediction = vo2max !== null ? predictRaceTime(vo2max, km * 1000) : null

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
        prediction,
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
      prediction,
    }
  })
}
