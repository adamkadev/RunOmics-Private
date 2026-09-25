import { ACTIVITY_TYPES, type ActivityType } from '@/domain/activity/types'
import { t } from '@/i18n'

/** A title that is just a type's name, in either language or as the key. */
const TYPE_WORDS = new Map<string, ActivityType>()
for (const type of ACTIVITY_TYPES) {
  TYPE_WORDS.set(type.toLowerCase(), type)
  TYPE_WORDS.set(t.activityTypes[type].toLowerCase(), type)
}
TYPE_WORDS.set('easy', 'Base')
TYPE_WORDS.set('easy run', 'Base')
TYPE_WORDS.set('vo2max', 'VO2Max')

/**
 * A planned session's title, agreeing with the zone it is drawn in. Garmin
 * sends a free-text name and a type; when the name is only a type word and
 * names a different type ("Threshold" on a VO₂ Max workout), the colour and
 * the title contradicted each other. The type is what the session is coloured
 * and measured by, so the title names it. A real title ("3 × 8 min
 * threshold") is kept as written.
 */
export function sessionTitle(name: string | null | undefined, type: ActivityType | null | undefined): string | null {
  const trimmed = name?.trim() ?? ''
  if (!type) return trimmed || null
  if (!trimmed) return t.activityTypes[type]
  const named = TYPE_WORDS.get(trimmed.toLowerCase())
  return named && named !== type ? t.activityTypes[type] : trimmed
}
