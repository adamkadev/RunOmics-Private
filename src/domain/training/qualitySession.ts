import type { ActivityType } from '@/domain/activity/types'

/** As Analytics' Intensity tab counts quality sessions: easy runs and races are neither. */
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
