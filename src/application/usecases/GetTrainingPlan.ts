import { getTrainingPlan as readTrainingPlan } from '@/infrastructure/repositories/JsonTrainingPlanRepository'

export type TrainingPlanPhase = 'base' | 'build' | 'peak' | 'taper' | 'raceDay'

// Garmin Coach's own phase names, mapped onto ours. Garmin publishes no BASE
// phase - the plan simply starts before BUILD - so 'base' is reconstructed from
// the plan's start date below rather than read from this table.
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
  /** The plan's own first day - earlier than the first phase, which starts at
   *  BUILD: Garmin does not publish the base weeks as a phase. */
  startDate: string
  endDate: string
  ranges: PlanPhaseRange[]
}

function dayBefore(date: string): string {
  const d = new Date(date + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

  // Garmin's phase list opens at BUILD, but the plan itself starts earlier: the
  // weeks in between are its base block. Without them the phase track would
  // claim the plan begins at BUILD and disagree with Garmin's own week count.
  const firstPhaseStart = ranges[0]!.startDate
  const withBase =
    raw.startDate < firstPhaseStart
      ? [{ phase: 'base' as const, startDate: raw.startDate, endDate: dayBefore(firstPhaseStart) }, ...ranges]
      : ranges

  return { name: raw.name, startDate: raw.startDate, endDate: raw.endDate, ranges: withBase }
}
