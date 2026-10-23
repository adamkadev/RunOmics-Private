import { getTrainingPlan as readTrainingPlan } from '@/infrastructure/repositories/JsonTrainingPlanRepository'
import type { TrainingPlanPhase, PlanPhaseRange } from '@/domain/training/planPhase'

export type { TrainingPlanPhase, PlanPhaseRange } from '@/domain/training/planPhase'

const GARMIN_PHASE: Record<string, TrainingPlanPhase> = {
  BUILD: 'build',
  PEAK: 'peak',
  TAPER: 'taper',
  TARGET_EVENT_DAY: 'raceDay',
}

export function garminPlanPhase(raw: string | null | undefined): TrainingPlanPhase | null {
  return raw ? (GARMIN_PHASE[raw] ?? null) : null
}

export interface TrainingPlan {
  name: string
  startDate: string
  endDate: string
  ranges: PlanPhaseRange[]
}

function dayBefore(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

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

  const firstPhaseStart = ranges[0]!.startDate
  const withBase =
    raw.startDate < firstPhaseStart
      ? [{ phase: 'base' as const, startDate: raw.startDate, endDate: dayBefore(firstPhaseStart) }, ...ranges]
      : ranges

  return { name: raw.name, startDate: raw.startDate, endDate: raw.endDate, ranges: withBase }
}
