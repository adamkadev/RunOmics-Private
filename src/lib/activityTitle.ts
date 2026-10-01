import { t } from '@/i18n'
import { formatWeekdayLong } from '@/lib/formatters'

/** A run's name: Garmin's, or "Sunday Run" / "Sortie du dimanche" from its date when Garmin gave none. */
export function activityTitle(activity: { description: string; date: string }): string {
  return activity.description || t.activity.runTitle(formatWeekdayLong(activity.date))
}
