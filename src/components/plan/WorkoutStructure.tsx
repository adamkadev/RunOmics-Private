import type { WorkoutStep } from '@/domain/activity/types'
import { WORKOUT_SEGMENT_COLORS } from '@/lib/colors'
import { sessionParts, stepSeconds } from './workoutSummary'

const RECOVERY_FILL = WORKOUT_SEGMENT_COLORS.recovery
const EASE_FILL = WORKOUT_SEGMENT_COLORS.warmup

function zoneFill(zone: number | null): string {
  return `var(--zone-${zone ?? 2})`
}

interface TileSegment {
  /** Seconds: the segment's share of the bar. */
  weight: number
  fill: string
}

function mainStep(steps: WorkoutStep[], body: WorkoutStep | null): WorkoutStep | null {
  const efforts = steps.filter((step) => step.kind === 'effort')
  return body ?? (efforts.length === 1 ? efforts[0]! : null)
}

/**
 * A stride and the jog after it are one sliver; between longer reps the
 * recovery is a block of its own, and none ends the session.
 */
export function tileSegments(steps: WorkoutStep[], zone: number | null): TileSegment[] {
  if (steps.length <= 1) return [{ weight: 1, fill: zoneFill(zone) }]
  const { body, strides } = sessionParts(steps)
  const main = mainStep(steps, body)
  // Short reps inside an easy run take Z5.
  const workFill = zone !== null && zone >= 3 ? zoneFill(zone) : zoneFill(5)
  const segments: TileSegment[] = []
  steps.forEach((step, i) => {
    const seconds = stepSeconds(step)
    if (step.kind === 'recovery') {
      const stride = strides && steps[i - 1]?.kind === 'effort' && steps[i - 1] !== main ? segments.at(-1) : undefined
      if (stride) stride.weight += seconds
      else if (i < steps.length - 1) segments.push({ weight: seconds, fill: RECOVERY_FILL })
      return
    }
    const easy = step.kind === 'warmup' || step.kind === 'cooldown'
    segments.push({ weight: seconds, fill: easy ? EASE_FILL : step === main ? zoneFill(zone) : workFill })
  })
  return segments
}
