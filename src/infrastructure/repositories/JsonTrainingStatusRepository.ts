import { dataPath } from '../dataPath'
import { dataGeneration } from '../dataFs'
import { readJsonFile } from '../readJsonFile'

export interface TrainingStatusDay {
  date: string
  status?: string
  feedback?: string
  fitnessTrend?: number
  acuteLoad?: number
  chronicLoad?: number
  acwr?: number
  acwrStatus?: string
  chronicLoadMin?: number
  chronicLoadMax?: number
}

type StoredDays = Record<string, Omit<TrainingStatusDay, 'date'>>
type StoredFile = { days?: StoredDays }

let cache: { generation: string; days: TrainingStatusDay[] } | null = null

function readFile(): StoredFile {
  return readJsonFile<StoredFile>(dataPath('training_status.json'), {})
}

function toSeries(stored: StoredDays | undefined): TrainingStatusDay[] {
  return Object.entries(stored ?? {})
    .map(([date, day]) => ({ date, ...day }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

export function getTrainingStatusDays(): TrainingStatusDay[] {
  const generation = dataGeneration()
  if (cache?.generation !== generation) cache = { generation, days: toSeries(readFile().days) }
  return cache.days
}

export function getLatestTrainingStatusDay(): TrainingStatusDay | null {
  const days = getTrainingStatusDays()
  for (let i = days.length - 1; i >= 0; i--) {
    const day = days[i]
    if (day && day.status && day.status !== 'no_status') return day
  }
  return null
}
