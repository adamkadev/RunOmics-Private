import type { PlanPhaseRange, TrainingPlanPhase } from '@/application/usecases/GetTrainingPlan'

/**
 * The plan phase covering most of a week's days - what the plan calls for,
 * read the same way `weekTrainingStatus` reads Garmin's verdict. A phase
 * boundary can fall mid-week (e.g. build ending Wednesday, peak starting
 * Thursday); the phase with the most days wins, ties going to the one the
 * week ends on. `dates` must be in chronological order.
 */
export function weekPlanPhase(dates: string[], ranges: PlanPhaseRange[]): TrainingPlanPhase | null {
  const counts = new Map<TrainingPlanPhase, number>()
  let last: TrainingPlanPhase | null = null

  for (const date of dates) {
    const range = ranges.find((r) => r.startDate <= date && date <= r.endDate)
    if (!range) continue
    counts.set(range.phase, (counts.get(range.phase) ?? 0) + 1)
    last = range.phase
  }

  if (last === null) return null

  let winner = last
  let winnerDays = counts.get(last) ?? 0
  for (const [phase, days] of counts) {
    if (days > winnerDays) {
      winner = phase
      winnerDays = days
    }
  }

  return winner
}
