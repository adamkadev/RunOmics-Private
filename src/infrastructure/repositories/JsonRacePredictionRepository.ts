import fs from 'fs'
import path from 'path'
import type { RaceDistanceKey } from '@/domain/race/distances'

/** One day of Garmin race predictions, in seconds, as written by scripts/garmin/race_predictions.py. */
export type RacePredictionDay = Partial<Record<RaceDistanceKey, number>> & { date: string }

type StoredDays = Record<string, Partial<Record<RaceDistanceKey, number>>>

export function getRacePredictionDays(): RacePredictionDay[] {
  const filePath = path.join(process.cwd(), 'public', 'data', 'race_predictions.json')
  if (!fs.existsSync(filePath)) return []

  try {
    const days = (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { days?: StoredDays }).days ?? {}
    return Object.entries(days)
      .map(([date, times]) => ({ date, ...times }))
      .sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}
