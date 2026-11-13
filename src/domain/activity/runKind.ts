import type { WorkoutBlock } from '@/domain/coaching/types'

/** A session's blocks hold strides, alone or inside a repeat: "Easy run + 6 strides" on Today's week strip. */
export function hasStrides(blocks: readonly WorkoutBlock[]): boolean {
  return blocks.some((block) =>
    block.kind === 'repeat' ? block.steps.some((step) => step.kind === 'strides') : block.kind === 'strides',
  )
}
