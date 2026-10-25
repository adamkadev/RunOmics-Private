import { activityRouteThumb } from './routeThumb'
import type { Activity, ActivitySummary, HrZone } from './types'

export function zoneSeconds(hrZones: readonly Pick<HrZone, 'zone' | 'seconds'>[]): number[] {
  const seconds: number[] = []
  for (const { zone, seconds: s } of hrZones) seconds[zone - 1] = (seconds[zone - 1] ?? 0) + s
  return Array.from(seconds, (s) => Math.round(s ?? 0))
}

export function toActivitySummary(a: Activity): ActivitySummary {
  return {
    id: a.id,
    date: a.date,
    dayOfWeek: a.dayOfWeek,
    type: a.type,
    description: a.description,
    comment: a.comment,
    distanceKm: a.distanceKm,
    durationSeconds: a.durationSeconds,
    paceSecPerKm: a.paceSecPerKm,
    avgHeartRate: a.avgHeartRate,
    zones: zoneSeconds(a.hrZones),
    gearId: a.gearId,
    routeThumb: activityRouteThumb(a),
  }
}
