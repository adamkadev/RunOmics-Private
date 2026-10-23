import { ACTIVITY_TYPES, type ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'

const TYPE_WORDS = new Map<string, ActivityType>()
for (const type of ACTIVITY_TYPES) {
  TYPE_WORDS.set(type.toLowerCase(), type)
  TYPE_WORDS.set(t.activityTypes[type].toLowerCase(), type)
}
TYPE_WORDS.set('easy', 'Base')
TYPE_WORDS.set('easy run', 'Base')
TYPE_WORDS.set('vo2max', 'VO2Max')

/**
 * Garmin's free-text name can be a bare type word naming another type
 * ("Threshold" on a VO₂ Max workout); the type wins, a real title is kept.
 */
export function sessionTitle(name: string | null | undefined, type: ActivityType | null | undefined): string | null {
  const trimmed = name?.trim() ?? ''
  if (!type) return trimmed || null
  if (!trimmed) return t.activityTypes[type]
  const named = TYPE_WORDS.get(trimmed.toLowerCase())
  return named && named !== type ? t.activityTypes[type] : trimmed
}
