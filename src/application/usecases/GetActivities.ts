import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { toActivitySummary } from '@/domain/activity/summary'
import type { Activity, ActivitySummary } from '@/domain/activity/types'

export function getActivities(): Activity[] {
  return getAllActivities()
}

export function getActivitySummaries(): ActivitySummary[] {
  return getAllActivities().map(toActivitySummary)
}
