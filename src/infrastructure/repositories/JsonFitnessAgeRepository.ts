import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface FitnessAgeSample {
  date: string
  years: number
}

// Keyed "weeks" by the sync, though Garmin's daily series fills it a day at a time.
type Stored = { weeks?: Record<string, { fitnessAgeYrs?: unknown }> }

export function getFitnessAgeSamples(): FitnessAgeSample[] {
  const { weeks } = readJsonFile<Stored>(dataPath('fitness_age_history.json'), {})
  return Object.entries(weeks ?? {})
    .flatMap(([date, sample]) => (typeof sample?.fitnessAgeYrs === 'number' ? [{ date, years: sample.fitnessAgeYrs }] : []))
    .sort((a, b) => a.date.localeCompare(b.date))
}
