import fs from 'fs'
import { dataPath } from '../dataPath'

export interface AthleteHistoryEntry {
  date: string
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
  vo2maxMlKgMin?: number
  weightKg?: number
}

type StoredDays = Record<string, Omit<AthleteHistoryEntry, 'date'>>

export function getAthleteHistory(): AthleteHistoryEntry[] {
  const filePath = dataPath('athlete_history.json')
  if (!fs.existsSync(filePath)) return []

  try {
    const days = (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { days?: StoredDays }).days ?? {}
    return Object.entries(days)
      .map(([date, values]) => ({ date, ...values }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}
