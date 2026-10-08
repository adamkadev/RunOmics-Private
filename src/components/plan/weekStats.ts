import type { WeekTarget } from '@/domain/training/weekTarget'

/**
 * How much of the plan that is already due was run: the planned sessions run
 * on their day, over those plus the ones missed. A session still to come -
 * today's included, until it is run - is not due yet, so a week that has not
 * started reads nothing rather than 0%. Null until a session is due.
 */
export function planAdherence(target: Pick<WeekTarget, 'planKm' | 'plannedDone' | 'missedSessions'>): number | null {
  if (target.planKm === null) return null
  const due = target.plannedDone + target.missedSessions
  return due > 0 ? Math.round((target.plannedDone / due) * 100) : null
}
