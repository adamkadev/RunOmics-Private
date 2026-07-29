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
type StoredFile = { days?: StoredDays; weeks?: StoredDays }

function readFile(): StoredFile {
  const filePath = path.join(process.cwd(), 'public', 'data', 'training_status.json')
  if (!fs.existsSync(filePath)) return {}

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as StoredFile
  } catch {
    return {}
  }
}

function toSeries(stored: StoredDays | undefined): TrainingStatusDay[] {
  return Object.entries(stored ?? {})
    .map(([date, day]) => ({ date, ...day }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getTrainingStatusDays(): TrainingStatusDay[] {
  return toSeries(readFile().days)
}

/**
 * Garmin's own weekly rollup, one record per week dated on the week's closing
 * day. Stored rather than derived: voting on the daily series reproduces only
 * 18 weeks out of 25.
 */
export function getTrainingStatusWeekSamples(): TrainingStatusDay[] {
  return toSeries(readFile().weeks)
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
