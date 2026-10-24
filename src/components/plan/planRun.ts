import type { ActivitySummary } from '@/domain/activity/types'

/** What Plan draws of a run: its route thumbnail, notes and the rest stay off the payload the tab bar prefetches. */
export type PlanRun = Pick<ActivitySummary, 'id' | 'date' | 'type' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm' | 'avgHeartRate' | 'hrZones'>

export function planRun({ id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate, hrZones }: ActivitySummary): PlanRun {
  return { id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate, hrZones }
}
