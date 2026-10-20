import type { Activity, ActivitySplit } from '@/domain/activity/types'

/** The Z4 floor when the athlete's zones are unknown (App Fixes 2b): 170 bpm. */
export const DEFAULT_Z4_FLOOR_BPM = 170

/**
 * A work lap of a quality session (App Fixes 2b): one the watch tagged as an
 * interval, or a plain lap run at threshold heart rate or above. Warm-up,
 * recovery, rest and cool-down laps never count, whatever their heart rate.
 */
export function isWorkLap(split: ActivitySplit, z4FloorBpm: number): boolean {
  if (split.type === 'interval_active') return true
  return split.type === 'lap' && split.avgHr !== null && split.avgHr >= z4FloorBpm
}

/**
 * Rep pace, in s/km: the work laps of the given sessions only, averaged by lap
 * distance (total time over total distance). "Workout pace" averaged whole
 * runs, warm-up and cool-down included, so a 4:30 session read 5:10. A run
 * without laps says nothing about its reps and is left out. Null when no
 * work lap is left.
 */
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
