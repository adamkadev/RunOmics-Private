import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeStats, type ShoeStats } from './GetShoeStats'
import type { Activity } from '@/domain/activity/types'

export interface ShoeDetail extends ShoeStats {
  firstUsedDate: string | null
  activities: Activity[]
}

export function getShoeDetail(gearId: string): ShoeDetail | null {
  const stats = getShoeStats().find((s) => s.gearId === gearId)
  if (!stats) return null

  const activities = getAllActivities()
    .filter((a) => a.gearId === gearId)
    .sort((a, b) => b.date.localeCompare(a.date))

  return {
    ...stats,
    firstUsedDate: activities.length > 0 ? activities[activities.length - 1].date : null,
    activities,
  }
}
