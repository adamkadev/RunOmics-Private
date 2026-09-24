/** The phases of Garmin's training plan, as the plan week view names them. */

export type TrainingPlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'raceDay'

export interface PlanPhaseRange {
  phase: TrainingPlanPhase
  startDate: string
  endDate: string
}
