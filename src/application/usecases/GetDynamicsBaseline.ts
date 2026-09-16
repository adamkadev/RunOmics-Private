import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import type { Activity } from '@/domain/activity/types'
import { median, round } from '@/lib/math'

export interface DynamicsBaseline {
  weeks: number
  runs: number
  strideLengthM: number | null
  groundContactMs: number | null
  verticalOscillationMm: number | null
  verticalRatioPct: number | null
}

const BASELINE_WEEKS = 8
const DAY_MS = 86_400_000
const MIN_RUNS = 3

function medianOf(runs: Activity[], pick: (a: Activity) => number | null | undefined, decimals: number): number | null {
  const values = runs.map(pick).filter((v): v is number => typeof v === 'number')
  return values.length >= MIN_RUNS ? round(median(values), decimals) : null
}

export function getDynamicsBaseline(activity: Activity): DynamicsBaseline | null {
  const end = Date.parse(activity.date + 'T00:00:00')
  const start = end - BASELINE_WEEKS * 7 * DAY_MS

  const runs = getAllActivities().filter((a) => {
    const at = Date.parse(a.date + 'T00:00:00')
    return at >= start && at < end
  })
  if (runs.length < MIN_RUNS) return null

  const baseline: DynamicsBaseline = {
    weeks: BASELINE_WEEKS,
    runs: runs.length,
    strideLengthM: medianOf(runs, (a) => a.strideLengthM, 2),
    groundContactMs: medianOf(runs, (a) => a.groundContactMs, 0),
    verticalOscillationMm: medianOf(runs, (a) => a.verticalOscillationMm, 1),
    verticalRatioPct: medianOf(runs, (a) => a.verticalRatioPct, 1),
  }

  const hasAny =
    baseline.strideLengthM !== null ||
    baseline.groundContactMs !== null ||
    baseline.verticalOscillationMm !== null ||
    baseline.verticalRatioPct !== null

  return hasAny ? baseline : null
}
