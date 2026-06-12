import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'

export function getActivities(): Activity[] {
  return getAllActivities()
}
