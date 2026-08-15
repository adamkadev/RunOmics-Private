import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getShoeRegistry } from '@/infrastructure/repositories/JsonShoeRepository'
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
  wearPercent: number
  nearingLimit: boolean
}

export function getShoeStats(): ShoeStats[] {
  const activities = getAllActivities()

  const byGear = new Map<string, number>()
  const sessionsByGear = new Map<string, number>()
  const lastUsedByGear = new Map<string, string>()

  for (const a of activities) {
    if (!a.gearId) continue
    byGear.set(a.gearId, (byGear.get(a.gearId) ?? 0) + a.distanceKm)
    sessionsByGear.set(a.gearId, (sessionsByGear.get(a.gearId) ?? 0) + 1)
    if (!lastUsedByGear.has(a.gearId)) lastUsedByGear.set(a.gearId, a.date)
  }

  return Object.entries(getShoeRegistry())
    .map(([gearId, info]) => {
      const totalKm = round(byGear.get(gearId) ?? 0, 1)
      return {
        gearId,
        name: info.name,
        brand: info.brand,
        maxKm: info.maxKm,
        alertThresholdKm: info.alertThresholdKm,
        retired: info.retired,
        totalKm,
        sessionCount: sessionsByGear.get(gearId) ?? 0,
        lastUsedDate: lastUsedByGear.get(gearId) ?? null,
        wearPercent: info.retired ? 100 : Math.min(100, round((totalKm / info.maxKm) * 100, 0)),
        nearingLimit: !info.retired && totalKm >= info.alertThresholdKm,
      }
    })
    .sort((a, b) => Number(a.retired) - Number(b.retired) || b.totalKm - a.totalKm)
}
