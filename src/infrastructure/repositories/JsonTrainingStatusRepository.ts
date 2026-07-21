import fs from 'fs'
import path from 'path'

/** One day of Garmin's own training status, as written by scripts/garmin/training_status.py. */
export interface TrainingStatusDay {
  date: string
  /** Garmin's feedback phrase without its variant number: `RECOVERY_2` -> `recovery`. */
  status?: string
  feedback?: string
  fitnessTrend?: number
  acuteLoad?: number
  chronicLoad?: number
  /** Acute/chronic ratio on Firstbeat load - unlike our own, not a kilometre proxy. */
  acwr?: number
  acwrStatus?: string
  /** Personalised optimal band for chronic load. No local equivalent exists. */
  chronicLoadMin?: number
  chronicLoadMax?: number
}

type StoredDays = Record<string, Omit<TrainingStatusDay, 'date'>>

function readDays(): StoredDays {
  const filePath = path.join(process.cwd(), 'public', 'data', 'training_status.json')
  if (!fs.existsSync(filePath)) return {}

  try {
    return (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { days?: StoredDays }).days ?? {}
  } catch {
    return {}
  }
}

export function getTrainingStatusDays(): TrainingStatusDay[] {
  return Object.entries(readDays())
    .map(([date, day]) => ({ date, ...day }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * Most recent day carrying a usable reading. Days before the watch had enough
 * history come back as `no_status` with no ratio; they are not a reading, and
 * returning one would make the app show a status Garmin itself declined to give.
 */
export function getLatestTrainingStatusDay(): TrainingStatusDay | null {
  const days = getTrainingStatusDays()
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]
    if (day && day.status && day.status !== 'no_status') return day
  }
  return null
}
