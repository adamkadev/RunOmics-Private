import type { ActivityType } from '@/domain/activity/types'

/**
 * Which training-zone the app's session types are run at, so a planned workout
 * can state its target pace instead of only its duration.
 *
 * Sprint, Anaerobic and Race are absent on purpose: reps at those efforts are
 * prescribed per-interval (or by the race itself), not as a steady zone pace,
 * and quoting a single range for them would be wrong rather than merely vague.
 */
const ZONE_BY_TYPE: Partial<Record<ActivityType, string>> = {
  Base: 'easy',
  Tempo: 'marathon',
  Threshold: 'threshold',
  VO2Max: 'vo2max',
}

export function paceZoneKeyFor(type: ActivityType | undefined): string | null {
  return (type && ZONE_BY_TYPE[type]) ?? null
}
