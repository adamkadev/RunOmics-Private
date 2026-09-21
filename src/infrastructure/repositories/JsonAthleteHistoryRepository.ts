import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface AthleteHistoryEntry {
  date: string
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  vo2maxMlKgMin?: number
  weightKg?: number
}

type StoredDays = Record<string, Omit<AthleteHistoryEntry, 'date'>>

export function getAthleteHistory(): AthleteHistoryEntry[] {
  const { days } = readJsonFile<{ days?: StoredDays }>(dataPath('athlete_history.json'), {})

  return Object.entries(days ?? {})
    .map(([date, values]) => ({ date, ...values }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
