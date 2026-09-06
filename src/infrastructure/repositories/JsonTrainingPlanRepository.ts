import fs from 'fs'
import { dataPath } from '../dataPath'

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

export function getTrainingPlan(): TrainingPlanRaw | null {
  const filePath = dataPath('training_plan.json')
  if (!fs.existsSync(filePath)) return null

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TrainingPlanRaw
  } catch {
    return null
  }
}
