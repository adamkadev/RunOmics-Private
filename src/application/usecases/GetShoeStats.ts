import type { ActivityType } from '@/domain/activity/types'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
import { kmPerWeek, wearPercent } from '@/domain/shoe/wearStatus'
import { round } from '@/lib/math'

export interface ShoeStats {
  gearId: string
  name: string
  brand: string
  maxKm: number
  alertThresholdKm: number
  retired: boolean
  totalKm: number
  sessionCount: number
  lastUsedDate: string | null
  firstUsedDate: string | null
  kmPerWeek: number
  wearPercent: number
  nearingLimit: boolean
  /** The session type worn in most often. */
  mainType?: ActivityType | null
}

export function getShoeStats(): ShoeStats[] {
  const activities = getAllActivities()

  const byGear = new Map<string, number>()
  const sessionsByGear = new Map<string, number>()
  const lastUsedByGear = new Map<string, string>()
  const firstUsedByGear = new Map<string, string>()
  const typesByGear = new Map<string, Map<ActivityType, number>>()

  for (const a of activities) {
    if (!a.gearId) continue
    byGear.set(a.gearId, (byGear.get(a.gearId) ?? 0) + a.distanceKm)
    sessionsByGear.set(a.gearId, (sessionsByGear.get(a.gearId) ?? 0) + 1)
    if (!lastUsedByGear.has(a.gearId)) lastUsedByGear.set(a.gearId, a.date)
    // getAllActivities is newest-first: the first date seen per gear is its last use.
    const earliest = firstUsedByGear.get(a.gearId)
    if (!earliest || a.date < earliest) firstUsedByGear.set(a.gearId, a.date)
    const types = typesByGear.get(a.gearId) ?? new Map<ActivityType, number>()
    types.set(a.type, (types.get(a.type) ?? 0) + 1)
    typesByGear.set(a.gearId, types)
  }

  return Object.entries(getShoeRegistry())
    .map(([gearId, info]) => {
      const totalKm = round(byGear.get(gearId) ?? 0, 1)
      const firstUsedDate = firstUsedByGear.get(gearId) ?? null
      const lastUsedDate = lastUsedByGear.get(gearId) ?? null
      return {
        gearId,
        name: info.name,
        brand: info.brand,
        maxKm: info.maxKm,
        alertThresholdKm: info.alertThresholdKm,
        retired: info.retired,
        totalKm,
        sessionCount: sessionsByGear.get(gearId) ?? 0,
        lastUsedDate,
        firstUsedDate,
        kmPerWeek: Math.round(kmPerWeek(firstUsedDate, lastUsedDate, totalKm)),
        wearPercent: wearPercent({ totalKm, maxKm: info.maxKm, retired: info.retired }),
        nearingLimit: !info.retired && totalKm >= info.alertThresholdKm,
        mainType: [...(typesByGear.get(gearId) ?? new Map<ActivityType, number>())].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null,
      }
    })
    .sort((a, b) => Number(a.retired) - Number(b.retired) || b.totalKm - a.totalKm)
}
