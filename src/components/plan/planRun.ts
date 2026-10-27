import type { Activity, ActivityType } from '@/domain/activity/types'

/** What Plan draws of a run: its route thumbnail, notes and the rest stay off the payload the tab bar prefetches. */
export type PlanRun = Pick<Activity, 'id' | 'date' | 'type' | 'description' | 'distanceKm' | 'durationSeconds' | 'paceSecPerKm' | 'avgHeartRate'> & {
  /** Percent of the run in heart-rate zones 1 to 5, as the watch gives it; a day card reads one. */
  zonePercents: (number | null)[]
  /** The session the run was set as, else its intended type: what "as planned" compares. */
  shownType: ActivityType
}

export function planRun(
  { id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate, hrZones }: Activity,
  shownType: ActivityType,
): PlanRun {
  const zonePercents: (number | null)[] = []
  for (const { zone, percent } of hrZones) zonePercents[zone - 1] = percent
  return { id, date, type, description, distanceKm, durationSeconds, paceSecPerKm, avgHeartRate, zonePercents: Array.from(zonePercents, (p) => p ?? null), shownType }
}
