import fs from 'fs'
import { dataPath } from '../dataPath'

export interface ThresholdSample {
  date: string
  lthrBpm?: number
  thresholdPaceSecPerKm?: number
}

export function getThresholdSamples(): ThresholdSample[] {
  const filePath = dataPath('threshold_history.json')
  if (!fs.existsSync(filePath)) return []

  try {
    const days = (JSON.parse(fs.readFileSync(filePath, 'utf-8')) as { days?: Record<string, ThresholdSample> }).days ?? {}
    return Object.values(days).sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}
