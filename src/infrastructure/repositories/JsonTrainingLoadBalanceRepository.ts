import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

export interface TrainingLoadBalance {
  date?: string
  feedback?: string
  aerobicLow?: number
  aerobicLowMin?: number
  aerobicLowMax?: number
  aerobicHigh?: number
  aerobicHighMin?: number
  aerobicHighMax?: number
  anaerobic?: number
  anaerobicMin?: number
  anaerobicMax?: number
}

export function getTrainingLoadBalance(): TrainingLoadBalance | null {
  return readJsonFile<TrainingLoadBalance | null>(dataPath('training_load_balance.json'), null)
}
