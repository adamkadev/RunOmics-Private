import type { Activity, ActivitySummary } from './types'

/**
 * Drops the per-sample arrays (route, pace/HR/cadence samples, splits) that make
 * up most of an activity's weight. Anything crossing the server/client boundary
 * for a list row or a card should go through this first.
 */
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
    rpe: a.rpe,
    hrZones: a.hrZones,
    week: a.week,
    elevationGain: a.elevationGain,
  }
}
