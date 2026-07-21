import { getTrainingPlan as readTrainingPlan } from '@/infrastructure/repositories/JsonTrainingPlanRepository'

export type TrainingPlanPhase = 'build' | 'peak' | 'taper' | 'raceDay'

// Garmin Coach's own phase names, mapped onto ours.
const GARMIN_PHASE: Record<string, TrainingPlanPhase> = {
  BUILD: 'build',
  PEAK: 'peak',
  TAPER: 'taper',
  TARGET_EVENT_DAY: 'raceDay',
}

/** Garmin's phase name in our vocabulary. Null for a phase name it never sends. */
export function garminPlanPhase(raw: string | null | undefined): TrainingPlanPhase | null {
  return raw ? (GARMIN_PHASE[raw] ?? null) : null
}

export interface PlanPhaseRange {
  phase: TrainingPlanPhase
  startDate: string
  endDate: string
}

export interface TrainingPlan {
  name: string
  ranges: PlanPhaseRange[]
}

/** The current Garmin Coach plan's phases, date-bracketed - what the plan calls for, not what happened. */
export function getTrainingPlan(): TrainingPlan | null {
  const raw = readTrainingPlan()
  if (!raw) return null

  const ranges = raw.phases
    .map((p): PlanPhaseRange | null => {
      const phase = garminPlanPhase(p.phase)
      return phase ? { phase, startDate: p.startDate, endDate: p.endDate } : null
    })
    .filter((r): r is PlanPhaseRange => r !== null)

  if (!ranges.length) return null
  return { name: raw.name, ranges }
}
