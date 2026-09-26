import { DAY_MS } from '@/lib/calendarDate'
import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import { median, round } from '@/lib/math'
import { isRunningActivity } from '@/domain/training/trainingHistory'

/**
 * A metric's own eight-week range. The median alone says whether this run sat
 * above or below usual; the range says whether that gap is unusual at all.
 */
export interface BaselineRange {
  median: number
  min: number
  max: number
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
  return {
    median: round(median(values), decimals),
    min: round(Math.min(...values), decimals),
    max: round(Math.max(...values), decimals),
  }
}

export function getDynamicsBaseline(activity: Activity): DynamicsBaseline | null {
  const end = Date.parse(activity.date + 'T00:00:00')
  const start = end - BASELINE_WEEKS * 7 * DAY_MS

  // Runs only, and no races: a 5K at race pace stretched the stride range to
  // 0.96–1.40 m, a range no training run lives in (H17).
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
