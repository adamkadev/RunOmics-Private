import type { ActivityType } from '@/domain/activity/types'

/**
 * A quality session, as Analytics' Intensity tab counts them (D4, v4.5):
 * threshold work (threshold and tempo runs) or intervals (VO2max, anaerobic
 * and sprint sessions). Easy runs and races are neither.
 */
export type QualityKind = 'threshold' | 'intervals'

const KIND: Partial<Record<ActivityType, QualityKind>> = {
  Threshold: 'threshold',
  Tempo: 'threshold',
  VO2Max: 'intervals',
  Anaerobic: 'intervals',
  Sprint: 'intervals',
}

export function qualityKind(type: ActivityType | undefined): QualityKind | null {
  return type ? (KIND[type] ?? null) : null
}
