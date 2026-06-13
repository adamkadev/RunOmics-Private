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

// Jack Daniels VDOT formula
function jackDanielsVO2max(seconds: number, distanceM: number): number {
  const v = (distanceM / seconds) * 60 // m/min
  const vo2 = -4.60 + 0.182258 * v + 0.000104 * v * v
  const t = seconds / 60
  const pct =
    0.8 +
    0.1894393 * Math.exp(-0.012778 * t) +
    0.2989558 * Math.exp(-0.1932605 * t)
  return Math.round((vo2 / pct) * 10) / 10
}

export function getVO2max(): number | null {
  const officialPbs = loadOfficialPbs()
  const activities = getAllActivities()

  // Prefer 5K, then 10K, then half - official time takes precedence over auto-detected
  const candidates: { seconds: number; distanceM: number }[] = []

  for (const [key, distM] of [['5k', 5000], ['10k', 10000], ['half', 21097.5]] as [string, number][]) {
    const official = officialPbs.get(key)
    if (official) {
      candidates.push({ seconds: official.seconds, distanceM: distM })
      break
    }
    let best: number | null = null
    for (const a of activities) {
      const sec = a.bestEfforts?.[key]
      if (sec != null && (best === null || sec < best)) best = sec
    }
    if (best !== null) {
      candidates.push({ seconds: best, distanceM: distM })
      break
    }
  }

  if (candidates.length === 0) return null
  return jackDanielsVO2max(candidates[0].seconds, candidates[0].distanceM)
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
