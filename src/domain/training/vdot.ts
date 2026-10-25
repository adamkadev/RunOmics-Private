import type { Activity } from '@/domain/activity/types'
import { EFFORTS } from '@/domain/activity/effort'
import { creditedEffortSeconds, type OfficialRaceResult } from '@/domain/activity/raceResult'
import { isRunningActivity } from '@/domain/training/trainingHistory'
import { DAY_MS } from '@/lib/calendarDate'

/**
 * Daniels and Gilbert's oxygen-cost equations: the VDOT an effort implies,
 * and the threshold pace that VDOT implies in turn.
 */
function oxygenCost(metresPerMinute: number): number {
  return -4.6 + 0.182258 * metresPerMinute + 0.000104 * metresPerMinute * metresPerMinute
}

export function vdotFromEffort(distanceKm: number, seconds: number): number {
  const velocity = (distanceKm * 1000) / (seconds / 60)
  const minutes = seconds / 60
  const percentMax = 0.8 + 0.1894393 * Math.exp(-0.012778 * minutes) + 0.2989558 * Math.exp(-0.1932605 * minutes)
  return oxygenCost(velocity) / percentMax
}

/** Daniels' T pace: the speed whose oxygen cost is 88% of VDOT, in seconds per km. */
export function thresholdPaceFromVdot(vdot: number): number {
  const cost = 0.88 * vdot
  const a = 0.000104
  const b = 0.182258
  const c = -4.6 - cost
  const metresPerMinute = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a)
  return Math.round(60_000 / metresPerMinute)
}

/** Daniels' tables start at 1500 m: a shorter effort leans on anaerobic capacity and reads too high. */
const MIN_EFFORT_KM = 1.5
const RECENT_DAYS = 120

export interface ThresholdEstimate {
  thresholdPaceSecPerKm: number
  vdot: number
  /** An EFFORTS key. */
  effort: string
  seconds: number
  date: string
  activityId: string
}

/** For a watch that reports no threshold pace: the best recent effort from a mile up, by VDOT. */
export function estimatedThreshold(
  activities: Activity[],
  officialByActivityId: Map<string, OfficialRaceResult>,
  today: string,
): ThresholdEstimate | null {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - RECENT_DAYS * DAY_MS).toISOString().slice(0, 10)
  let best: Omit<ThresholdEstimate, 'thresholdPaceSecPerKm'> | null = null
  for (const activity of activities) {
    const date = activity.date.slice(0, 10)
    if (date < since || date > today || !isRunningActivity(activity)) continue
    for (const { key, km } of EFFORTS) {
      if (km < MIN_EFFORT_KM) continue
      const seconds = creditedEffortSeconds(activity, key, km, officialByActivityId)
      if (!seconds) continue
      const vdot = vdotFromEffort(km, seconds)
      if (!best || vdot > best.vdot) best = { vdot, effort: key, seconds, date, activityId: activity.id }
    }
  }
  return best ? { ...best, vdot: Math.round(best.vdot * 10) / 10, thresholdPaceSecPerKm: thresholdPaceFromVdot(best.vdot) } : null
}
