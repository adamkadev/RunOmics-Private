import fs from 'fs'
import { dataPath } from '../dataPath'

/**
 * One VO2max sample, as written by scripts/garmin/vo2max_history.py. This is
 * Garmin's own series, which carries the decimal the per-activity readings
 * round away.
 */
export interface Vo2maxSample {
  /** Day Garmin took the sample on. */
  date: string
  vo2max: number
  fitnessAge?: number
}

/** Monthly samples for the long views, daily ones for the recent window. */
export interface Vo2maxSamples {
  months: Vo2maxSample[]
  days: Vo2maxSample[]
}

type Stored = { months?: Record<string, Vo2maxSample>; days?: Record<string, Vo2maxSample> }

export function getVo2maxSamples(): Vo2maxSamples {
  const filePath = dataPath('vo2max_history.json')
  if (!fs.existsSync(filePath)) return { months: [], days: [] }

  try {
    const stored = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Stored
    return { months: byDate(stored.months), days: byDate(stored.days) }
  } catch {
    return { months: [], days: [] }
  }
}

function byDate(samples: Record<string, Vo2maxSample> | undefined): Vo2maxSample[] {
  return Object.values(samples ?? {}).sort((a, b) => a.date.localeCompare(b.date))
}
