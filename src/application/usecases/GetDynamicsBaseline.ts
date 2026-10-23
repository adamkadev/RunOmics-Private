import { DAY_MS } from '@/lib/calendarDate'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import { median, round } from '@/lib/math'
import { isRunningActivity } from '@/domain/training/trainingHistory'

/** A metric's eight-week range; low and high are the quartiles, the band the Dynamics tab shades. */
export interface BaselineRange {
  median: number
  min: number
  max: number
  low: number
  high: number
}

function quantile(sorted: number[], q: number): number {
  const at = (sorted.length - 1) * q
  const below = Math.floor(at)
  const above = Math.ceil(at)
  return sorted[below]! + (sorted[above]! - sorted[below]!) * (at - below)
}

export interface DynamicsBaseline {
  weeks: number
  runs: number
  strideLengthM: BaselineRange | null
  groundContactMs: BaselineRange | null
  verticalOscillationMm: BaselineRange | null
  verticalRatioPct: BaselineRange | null
}

const BASELINE_WEEKS = 8
const MIN_RUNS = 3

function rangeOf(
  runs: Activity[],
  pick: (a: Activity) => number | null | undefined,
  decimals: number,
): BaselineRange | null {
  const values = runs.map(pick).filter((v): v is number => typeof v === 'number')
  if (values.length < MIN_RUNS) return null
  const sorted = [...values].sort((a, b) => a - b)
  return {
    median: round(median(values), decimals),
    min: round(sorted[0]!, decimals),
    max: round(sorted[sorted.length - 1]!, decimals),
    low: round(quantile(sorted, 0.25), decimals),
    high: round(quantile(sorted, 0.75), decimals),
  }
}

export function getDynamicsBaseline(activity: Activity): DynamicsBaseline | null {
  const end = Date.parse(activity.date + 'T00:00:00')
  const start = end - BASELINE_WEEKS * 7 * DAY_MS

  // No races: a race-pace 5K stretches the stride range past anything a training run reaches.
  const runs = getAllActivities().filter((a) => {
    const at = Date.parse(a.date + 'T00:00:00')
    return at >= start && at < end && isRunningActivity(a) && a.type !== 'Race'
  })
  if (runs.length < MIN_RUNS) return null

  const baseline: DynamicsBaseline = {
    weeks: BASELINE_WEEKS,
    runs: runs.length,
    strideLengthM: rangeOf(runs, (a) => a.strideLengthM, 2),
    groundContactMs: rangeOf(runs, (a) => a.groundContactMs, 0),
    verticalOscillationMm: rangeOf(runs, (a) => a.verticalOscillationMm, 1),
    verticalRatioPct: rangeOf(runs, (a) => a.verticalRatioPct, 1),
  }

  const hasAny =
    baseline.strideLengthM !== null ||
    baseline.groundContactMs !== null ||
    baseline.verticalOscillationMm !== null ||
    baseline.verticalRatioPct !== null

  return hasAny ? baseline : null
}
