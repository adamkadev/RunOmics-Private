import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import type { Activity } from '@/domain/activity/types'
import { round } from '@/lib/math'

export interface ShoeDetail {
  gearId: string
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  totalKm: number
  wearPercent: number
  firstUsedDate: string | null
  kmPerWeek: number
  activities: Activity[]
}

export function getShoeDetail(gearId: string): ShoeDetail | null {
  const info = getShoeRegistry()[gearId]
  if (!info) return null

  const activities = getAllActivities()
    .filter((a) => a.gearId === gearId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalKm = round(activities.reduce((sum, a) => sum + a.distanceKm, 0), 1)
  const firstUsedDate = activities.at(-1)?.date ?? null
  const daysSinceFirstUse = firstUsedDate
    ? Math.max(1, (Date.now() - new Date(firstUsedDate).getTime()) / 86_400_000)
    : 0
  const kmPerWeek = daysSinceFirstUse > 0 ? round((totalKm / daysSinceFirstUse) * 7, 1) : 0

  return {
    gearId,
    name: info.name,
    brand: info.brand,
    maxKm: info.maxKm,
    alertThresholdKm: info.alertThresholdKm,
    retired: info.retired,
    totalKm,
    wearPercent: info.retired ? 100 : Math.min(100, round((totalKm / info.maxKm) * 100, 0)),
    firstUsedDate,
    kmPerWeek,
    activities,
  }
}
