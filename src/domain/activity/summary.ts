import { repSet } from './repSet'
import { activityRouteThumb } from './routeThumb'
import type { Activity, ActivitySummary, HrZone } from './types'

export function zoneSeconds(hrZones: readonly Pick<HrZone, 'zone' | 'seconds'>[]): number[] {
  const seconds: number[] = []
  for (const { zone, seconds: s } of hrZones) seconds[zone - 1] = (seconds[zone - 1] ?? 0) + s
  return Array.from(seconds, (s) => Math.round(s ?? 0))
}

/** `athleteHasLthr`: zones count with an LTHR or a run's Training Effect, as docs/profiles.md sets out. */
export function toActivitySummary(a: Activity, athleteHasLthr = false): ActivitySummary {
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
    // Without either, the watch zones by max HR alone, which reads easy runs as Z3: no easy share from them.
    zones: athleteHasLthr || a.aerTrainingEffect != null ? zoneSeconds(a.hrZones) : [],
    gearId: a.gearId,
    routeThumb: activityRouteThumb(a),
    ...strideCount(a),
  }
}

function strideCount(a: Activity): { strides?: number } {
  const set = repSet(a.splits ?? null)
  return set?.strides ? { strides: set.reps.length } : {}
}
