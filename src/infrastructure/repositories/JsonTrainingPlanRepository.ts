import fs from 'fs'
import { dataPath } from '../dataPath'

/** One phase of the athlete's current Garmin Coach plan, as written by scripts/garmin/training_plan.py. */
export interface TrainingPlanPhaseRaw {
  phase: string
  startDate: string
  endDate: string
}

export interface TrainingPlanRaw {
  planId: number
  name: string
  startDate: string
  endDate: string
  phases: TrainingPlanPhaseRaw[]
}

/** The current Garmin Coach plan, or null when the athlete has none active (or never synced one). */
export function getTrainingPlan(): TrainingPlanRaw | null {
  const filePath = dataPath('training_plan.json')
  if (!fs.existsSync(filePath)) return null

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TrainingPlanRaw
  } catch {
    return null
  }
}
