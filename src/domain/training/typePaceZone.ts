import type { ActivityType } from '@/domain/activity/types'

const ZONE_BY_TYPE: Partial<Record<ActivityType, string>> = {
  Base: 'easy',
  Tempo: 'marathon',
  Threshold: 'threshold',
  VO2Max: 'vo2max',
}

export function paceZoneKeyFor(type: ActivityType | undefined): string | null {
  return (type && ZONE_BY_TYPE[type]) ?? null
}
