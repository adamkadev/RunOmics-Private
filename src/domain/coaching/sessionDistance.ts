import type { NumberRange, WorkoutBlock, WorkoutPrescription, WorkoutSegment, WorkoutSegmentKind } from './types'

/** Slower than 10:30 /km is walking: a run/walk return jogs near 10:00 /km and walks at 11–14. */
export const WALK_PACE_FLOOR_SEC_PER_KM = 630

const WALK_NOTE = /\bwalk|\bmarch(e|er|ant)\b/i
const EASY_STEPS: ReadonlySet<WorkoutSegmentKind> = new Set(['warmup', 'cooldown', 'recovery'])
const EASY_TYPES: ReadonlySet<WorkoutPrescription['type']> = new Set(['easy', 'recovery', 'long_run'])

export function isWalkSegment(segment: WorkoutSegment): boolean {
  const pace = segment.target.paceSecPerKm
  if (pace && pace.min >= WALK_PACE_FLOOR_SEC_PER_KM) return true
  return (segment.notes ?? []).some((note) => WALK_NOTE.test(note))
}

function paceMeters(seconds: number, pace: NumberRange): number {
  return (seconds * 2_000) / (pace.min + pace.max)
}

/** A warm-up, cool-down or recovery given only a duration is still run, so it covers ground at `easyPace`. */
export function segmentMeters(segment: WorkoutSegment, easyPace: NumberRange | null = null): number {
  const { distanceMeters, durationSeconds, paceSecPerKm } = segment.target
  if (distanceMeters !== undefined) return distanceMeters
  if (durationSeconds === undefined) return 0
  if (paceSecPerKm) return paceMeters(durationSeconds, paceSecPerKm)
  if (easyPace && EASY_STEPS.has(segment.kind) && !isWalkSegment(segment)) return paceMeters(durationSeconds, easyPace)
  return 0
}

export function blocksMeters(blocks: readonly WorkoutBlock[], easyPace: NumberRange | null = null): number {
  return blocks.reduce((total, block) => block.kind === 'repeat'
    ? total + block.repetitions * block.steps.reduce((sum, step) => sum + segmentMeters(step, easyPace), 0)
    : total + segmentMeters(block, easyPace), 0)
}

export function prescriptionMeters(
  workout: Pick<WorkoutPrescription, 'blocks' | 'totalDistanceMeters'>,
  easyPace: NumberRange | null = null,
): number | null {
  if (workout.totalDistanceMeters !== undefined) return workout.totalDistanceMeters
  return Math.round(blocksMeters(workout.blocks, easyPace)) || null
}

/** The span of the running paces the plan gives its easy sessions and its warm-ups, cool-downs and recoveries. */
export function planEasyPace(workouts: readonly Pick<WorkoutPrescription, 'type' | 'blocks'>[]): NumberRange | null {
  let min = Infinity
  let max = -Infinity
  for (const workout of workouts) {
    for (const block of workout.blocks) {
      for (const step of block.kind === 'repeat' ? block.steps : [block]) {
        const pace = step.target.paceSecPerKm
        if (!pace || step.kind === 'strides' || isWalkSegment(step)) continue
        if (!EASY_TYPES.has(workout.type) && !EASY_STEPS.has(step.kind)) continue
        min = Math.min(min, pace.min)
        max = Math.max(max, pace.max)
      }
    }
  }
  return min <= max ? { min, max } : null
}
