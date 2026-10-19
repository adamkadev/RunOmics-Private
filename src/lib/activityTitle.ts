import { t } from '@/i18n'
import { formatWeekdayLong } from '@/lib/formatters'

/** A run's name: Garmin's, or "Sunday Run" / "Sortie du dimanche" from its date when Garmin gave none. */
export function activityTitle(activity: { description: string; date: string }): string {
  return activity.description || t.activity.runTitle(formatWeekdayLong(activity.date))
}

/** A run's name split for a list row: the session's name, and its structure when the name carries one. */
export interface TitleParts {
  name: string
  structure: string | null
}

/**
 * A structured name - "Threshold 2 × 7:00 - 2 × 7′", "Threshold · 3 × 8′ @
 * 4:25", "Répétitions allure d'objectif - 4x3'@4:24" - truncated on a list
 * row, its structure the part cut off (3.0.2). Split where the words give
 * way to the first number, and only when what follows reads as a structure:
 * reps ("2 × 7", "4x3") or minutes and seconds ("8′", "3'"). "Easy Run",
 * "5K Race" and "Morning Run 10 km" stay whole.
 */
export function splitStructuredTitle(title: string): TitleParts {
  const match = /^(\p{L}[^\d]*?)[\s·:,\-–—]+(\d.*)$/u.exec(title.trim())
  if (!match) return { name: title, structure: null }
  const [, name, structure] = match as unknown as [string, string, string]
  const structured = /\d\s*[×xX]\s*\d/.test(structure) || /\d\s*[′']/.test(structure)
  return structured && name.trim() ? { name: name.trim(), structure: structure.trim() } : { name: title, structure: null }
}
