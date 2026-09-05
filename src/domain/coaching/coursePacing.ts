import type { TargetEvent, WorkoutPrescription } from './types'
import { raceTargetFacts } from './raceTarget'

export function hasCoursePacing(event: Pick<TargetEvent, 'courseContext'>): boolean {
  return Boolean(event.courseContext?.pacingNotes.length || event.courseContext?.paceProSplits?.length)
}

/** Refine a full-distance race effort only; retain all other prescription fields. */
export function withCourseAwareRacePacing(workout: WorkoutPrescription, event: TargetEvent): WorkoutPrescription {
  if (!hasCoursePacing(event)) return structuredClone(workout)
  if (workout.type !== 'race' || workout.date !== event.date) throw new Error('Course pacing requires the matching race workout')
  const facts = raceTargetFacts(event)
  const splits = event.courseContext?.paceProSplits
  if (splits?.length && splits.reduce((sum, split) => sum + split.distanceMeters, 0) !== event.distanceMeters) {
    throw new Error('PacePro splits must cover the race distance')
  }
  if (splits?.length && event.targetSeconds !== undefined && splits.reduce((sum, split) => sum + split.targetSeconds, 0) !== event.targetSeconds) {
    throw new Error('PacePro splits must agree with the explicit finish goal')
  }
  let matched = false
  const result = structuredClone(workout)
  result.blocks = result.blocks.map(block => {
    if (block.kind !== 'effort' || block.target.distanceMeters !== event.distanceMeters) return block
    matched = true
    const target = { ...block.target }
    delete target.paceSecPerKm
    return {
      ...block,
      target,
      notes: [
        ...(facts.targetPace ? [`Average goal pace: ${facts.targetPace} over the whole course, not a constant pace requirement.`] : []),
        'Run by controlled race effort and follow the supplied course/PacePro strategy; allow pace to vary with the terrain.',
        ...(event.courseContext?.pacingNotes ?? []),
        ...(splits ?? []).map((split, index) => `Supplied PacePro split ${index + 1}: ${split.distanceMeters} m in ${split.targetSeconds} seconds; course-segment guidance, not constant instantaneous pace.`),
      ],
    }
  })
  if (!matched) throw new Error('Expected a full-distance race effort to refine')
  return result
}
