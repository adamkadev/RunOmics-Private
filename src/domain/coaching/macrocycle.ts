import type { CoachState, CoachingPlan } from './types'

export function resolveMacrocycleStart(
  state: CoachState | null,
  primaryTargetId: string,
  planningStartDate: string,
): string {
  const carried = state?.macrocycle
  return carried && carried.targetEventId === primaryTargetId ? carried.startDate : planningStartDate
}

export function macrocycleOf(plan: CoachingPlan): { targetEventId: string; startDate: string } {
  return {
    targetEventId: plan.targetEvent.id,
    startDate: plan.macrocycleStartDate ?? plan.block.startDate,
  }
}
