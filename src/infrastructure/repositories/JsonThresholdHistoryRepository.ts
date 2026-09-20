import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface ThresholdSample {
  date: string
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
}

export function getThresholdSamples(): ThresholdSample[] {
  const { days } = readJsonFile<{ days?: Record<string, ThresholdSample> }>(
    dataPath('threshold_history.json'),
    {}
  )

  return Object.values(days ?? {}).sort((a, b) => a.date.localeCompare(b.date))
}
