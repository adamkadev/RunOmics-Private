import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import {
  macrocyclePhaseRanges,
  macrocycleWeek,
  preparationWeek,
  type MacrocycleSpan,
} from '@/components/coaching/presentation'
import { t } from '@/i18n'

export interface PlanPhaseLine {
  phase: string | null
  week: string | null
}

export function planPhaseLine(
  plan: MacrocycleSpan | null,
  planPhaseRanges: readonly PlanPhaseRange[],
  date: string,
): PlanPhaseLine | null {
  const monday = startOfWeek(new Date(`${date}T00:00:00`))
  const dates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(monday, i)))
  const firstDay = dates[0]!
  const lastDay = dates[6]!

  const coachRanges = plan ? macrocyclePhaseRanges(plan) : []
  const ranges = plan ? coachRanges : [...planPhaseRanges]
  const phase = weekPlanPhase(dates, coachRanges.length > 0 ? coachRanges : [...planPhaseRanges])
  const targetWeek = plan ? macrocycleWeek(plan, firstDay) : null
  const prepWeek = plan ? preparationWeek(plan, firstDay) : null
  const isPrePlan = phase === null && ranges.length > 0 && lastDay < ranges[0]!.startDate

  const w = t.plan.weekPurpose
  const phaseLabel = phase ? w.planPhase[phase] : prepWeek !== null ? w.generalPreparation : isPrePlan ? w.prePlan : null
  const weekLabel = !isPrePlan && targetWeek ? w.weekOfTarget(targetWeek.done, targetWeek.total) : prepWeek !== null ? w.weekN(prepWeek) : null
  return phaseLabel || weekLabel ? { phase: phaseLabel, week: weekLabel } : null
}
