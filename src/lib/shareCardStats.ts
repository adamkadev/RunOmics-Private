import type { Activity } from '@/domain/activity/types'
import { t } from '@/i18n'

export function shareCardTitle(activity: Activity): string {
  return activity.description || t.activity.runTitle(activity.dayOfWeek)
}
