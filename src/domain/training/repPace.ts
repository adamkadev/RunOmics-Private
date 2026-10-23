import type { Activity, ActivitySplit } from '@/domain/activity/types'

/** The Z4 floor when the athlete's zones are unknown. */
export const DEFAULT_Z4_FLOOR_BPM = 170

/** Warm-up, recovery, rest and cool-down laps never count, whatever their heart rate. */
export function isWorkLap(split: ActivitySplit, z4FloorBpm: number): boolean {
  if (split.type === 'interval_active') return true
  return split.type === 'lap' && split.avgHr !== null && split.avgHr >= z4FloorBpm
}

/** Over work laps only, weighted by lap distance: a whole-run average counts the warm-up and cool-down. */
export function repPaceSecPerKm(acts: readonly Pick<Activity, 'splits'>[], z4FloorBpm = DEFAULT_Z4_FLOOR_BPM): number | null {
  let seconds = 0
  let metres = 0
  for (const a of acts) {
    for (const split of a.splits ?? []) {
      if (!isWorkLap(split, z4FloorBpm) || split.distanceM <= 0) continue
      seconds += split.durationSec
      metres += split.distanceM
    }
  }
  return metres > 0 ? Math.round(seconds / (metres / 1000)) : null
}
