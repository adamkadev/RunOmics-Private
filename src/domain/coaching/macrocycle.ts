import type { CoachState, CoachingPlan } from './types'

/**
 * The macrocycle is the whole journey toward the primary target race. Rolling
 * adaptive blocks live inside it: a new block moves `block.startDate` forward,
 * but the journey - and therefore "week X of Y" - carries on from where training
 * toward that target actually began.
 *
 * A macrocycle is only restarted when the primary target itself changes.
 */
export function resolveMacrocycleStart(
  state: CoachState | null,
  primaryTargetId: string,
  planningStartDate: string,
): string {
  const carried = state?.macrocycle
  return carried && carried.targetEventId === primaryTargetId ? carried.startDate : planningStartDate
}

/** The macrocycle a plan belongs to, for persisting alongside it. */
export function macrocycleOf(plan: CoachingPlan): { targetEventId: string; startDate: string } {
  return {
    targetEventId: plan.targetEvent.id,
    // Plans written before the field existed anchor on their own block.
    startDate: plan.macrocycleStartDate ?? plan.block.startDate,
  }
}
