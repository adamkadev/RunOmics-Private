import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'
import type { RaceDistanceKey } from '@/domain/race/distances'

export type RacePredictionDay = Partial<Record<RaceDistanceKey, number>> & { date: string }

type StoredDays = Record<string, Partial<Record<RaceDistanceKey, number>>>

export function getRacePredictionDays(): RacePredictionDay[] {
  const { days } = readJsonFile<{ days?: StoredDays }>(dataPath('race_predictions.json'), {})

  return Object.entries(days ?? {})
    .map(([date, times]) => ({ date, ...times }))
    .sort((a, b) => a.date.localeCompare(b.date))
}
