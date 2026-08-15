import fs from 'fs'
import { dataPath } from '../dataPath'

/**
 * Garmin's rolling 4-week load split across intensity buckets, as written by
 * scripts/garmin/training_status.py. The target bounds are personalised by the
 * watch from the athlete's own history - there is no local equivalent.
 */
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
  const filePath = dataPath('training_load_balance.json')
  if (!fs.existsSync(filePath)) return null

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TrainingLoadBalance
  } catch {
    return null
  }
}
