import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface Vo2maxSample {
  date: string
  vo2max: number
  fitnessAge?: number
}

export interface Vo2maxSamples {
  months: Vo2maxSample[]
  days: Vo2maxSample[]
}

type Stored = { months?: Record<string, Vo2maxSample>; days?: Record<string, Vo2maxSample> }

export function getVo2maxSamples(): Vo2maxSamples {
  const stored = readJsonFile<Stored>(dataPath('vo2max_history.json'), {})

  return { months: byDate(stored.months), days: byDate(stored.days) }
}

function byDate(samples: Record<string, Vo2maxSample> | undefined): Vo2maxSample[] {
  return Object.values(samples ?? {}).sort((a, b) => a.date.localeCompare(b.date))
}
