import { dataPath } from '../dataPath'
import { readJsonFile } from '../readJsonFile'

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
  return readJsonFile<TrainingPlanRaw | null>(dataPath('training_plan.json'), null)
}
