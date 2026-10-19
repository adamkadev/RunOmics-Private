import type { PlanPhaseRange } from '@/application/usecases/GetTrainingPlan'
import { weekPlanPhase } from '@/domain/training/weekPlanPhase'
import { addDays, isoDate, startOfWeek } from '@/lib/calendarDate'
import { shortDist } from '@/components/goals/shortDistance'
import {
  macrocyclePhaseRanges,
  macrocycleWeek,
  preparationWeek,
  type MacrocycleSpan,
} from '@/components/coaching/presentation'
import { t } from '@/i18n'
import { daysUntil, raceTitle, type PlanRace } from './planRace'

/** Where the plan is in a week: "General preparation" and "week 2", or "Build" and "week 9 of 12". */
export interface PlanPhaseLine {
  phase: string | null
  week: string | null
}

/**
 * The phase and the week count of the week a date falls in - the coaching
 * block's, else Garmin's phase ranges. Plan's subtitle and Progress's race
 * tile both read it, so they never name two different weeks.
 */
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
  // General preparation has no race to count toward, so it counts its own weeks.
  const prepWeek = plan ? preparationWeek(plan, firstDay) : null
  // Before the ranges reach this week: its own label, and no week count.
  const isPrePlan = phase === null && ranges.length > 0 && lastDay < ranges[0]!.startDate

  const w = t.plan.weekPurpose
  const phaseLabel = phase ? w.planPhase[phase] : prepWeek !== null ? w.generalPreparation : isPrePlan ? w.prePlan : null
  const weekLabel = !isPrePlan && targetWeek ? w.weekOfTarget(targetWeek.done, targetWeek.total) : prepWeek !== null ? w.weekN(prepWeek) : null
  return phaseLabel || weekLabel ? { phase: phaseLabel, week: weekLabel } : null
}

/** The race in the subtitle: "Half in 42 d". */
export function raceCountdown(race: PlanRace, today: string): string {
  return t.plan.header.raceIn(shortDist(race.distance) || raceTitle(race), daysUntil(race.date, today))
}
