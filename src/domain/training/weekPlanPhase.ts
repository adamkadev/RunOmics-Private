import type { PlanPhaseRange, TrainingPlanPhase } from '@/domain/training/planPhase'

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
