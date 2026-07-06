import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { SHOE_REGISTRY } from '@/domain/shoe/types'
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
  activities: Activity[]
}

export function getShoeDetail(gearId: string): ShoeDetail | null {
  const info = SHOE_REGISTRY[gearId]
  if (!info) return null

  const activities = getAllActivities()
    .filter((a) => a.gearId === gearId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const totalKm = round(activities.reduce((sum, a) => sum + a.distanceKm, 0), 1)

  return {
    gearId,
    name: info.name,
    brand: info.brand,
    maxKm: info.maxKm,
    alertThresholdKm: info.alertThresholdKm,
    retired: info.retired,
    totalKm,
    wearPercent: info.retired ? 100 : Math.min(100, round((totalKm / info.maxKm) * 100, 0)),
    firstUsedDate: activities.at(-1)?.date ?? null,
    activities,
  }
}
