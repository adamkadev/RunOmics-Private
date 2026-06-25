import type { Activity } from '@/domain/activity/types'
import { formatDistance, formatDuration, formatPace } from '@/lib/formatters'
import { t } from '@/i18n'

export function shareCardTitle(activity: Activity): string {
  return activity.description || t.activity.runTitle(activity.dayOfWeek)
}

export interface ShareStatItem { value: string; label: string; big: boolean }

export function buildStatItems(activity: Activity): ShareStatItem[] {
  const stats: ShareStatItem[] = [
    { value: formatDistance(activity.distanceKm), label: t.activity.shareCard.distance, big: true },
    { value: formatDuration(activity.durationSeconds), label: t.activity.shareCard.time, big: true },
  ]
  if (activity.paceSecPerKm) stats.push({ value: formatPace(activity.paceSecPerKm), label: t.activity.shareCard.pace, big: false })
  if (activity.avgHeartRate) stats.push({ value: `${activity.avgHeartRate} bpm`, label: t.activity.shareCard.avgHr, big: false })
  return stats
}
