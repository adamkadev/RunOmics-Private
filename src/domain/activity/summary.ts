import { activityRouteThumb } from './routeThumb'
import type { Activity, ActivitySummary } from './types'

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
    routeThumb: activityRouteThumb(a),
  }
}
