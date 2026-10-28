import type { ActivityType } from '@/domain/activity/types'

/** Garmin's type words are jargon the model echoes back ("Base", "VO2Max"): a prompt names a session in plain words. */
export const SESSION_LABEL: Record<ActivityType, string> = {
  Base: 'an easy run',
  Tempo: 'a tempo session',
  Threshold: 'a threshold session',
  VO2Max: 'an interval session',
  Anaerobic: 'an interval session',
  Sprint: 'a sprint session',
  Race: 'a race',
}

const COACH_TYPE_WORDS = /^(base|endurance|footing|r[ée]cup[ée]ration|recovery|tempo|seuil|threshold|vma|vo2 ?max|ana[ée]robique|anaerobic|sprint|vitesse)$/i

/** Garmin Coach names a session by its type word alone, which says nothing its label does not. */
export function isCoachTypeWord(name: string): boolean {
  return COACH_TYPE_WORDS.test(name.trim())
}
