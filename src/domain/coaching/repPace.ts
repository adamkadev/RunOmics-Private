import type { NumberRange, WorkoutPrescription, WorkoutSegment } from './types'

/** A set with an HR-only rep or reps at different paces has no one range to grade every rep against. */
export function prescribedRepPace(prescription: Pick<WorkoutPrescription, 'blocks'> & Partial<Pick<WorkoutPrescription, 'type'>> | null): NumberRange | null {
  if (!prescription) return null
  const repeated = prescription.blocks.flatMap((block) => (block.kind === 'repeat' ? block.steps.filter((step) => step.kind === 'effort') : []))
  const written = prescription.blocks.filter((block): block is WorkoutSegment => block.kind === 'effort')
  const efforts = repeated.length > 0 ? repeated : written.length >= 2 ? written : []
  // A controlled threshold rep is held by its heart rate; the few seconds of pace beside it are only a guide.
  if (prescription.type === 'threshold' && efforts.some((step) => step.target.hrBpm)) return null
  const paces = efforts.map((step) => step.target.paceSecPerKm)
  const first = paces[0]
  if (!first || paces.some((pace) => !pace || pace.min !== first.min || pace.max !== first.max)) return null
  return { min: Math.round(first.min), max: Math.round(first.max) }
}
