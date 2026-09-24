import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'

/** What a share card reads of a run - all the share modal is handed. */
export type ShareActivity = Pick<
  Activity,
  'id' | 'date' | 'dayOfWeek' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm' | 'avgHeartRate' | 'elevationGain' | 'route'
>

export function shareCardTitle(activity: ShareActivity): string {
  return activity.description || t.activity.runTitle(activity.dayOfWeek)
}
