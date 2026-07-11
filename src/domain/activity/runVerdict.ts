export type VerdictTone = 'positive' | 'neutral' | 'caution'

// Rules layer over already-computed RPE and aerobic training effect - reuses the
// same RPE bands as the stats card (easy <=4, moderate 5-6, hard 7-10) and the
// training-effect scale from TrainingEffect (>= 4.8 = overreaching). No new data.
export function runVerdictTone(rpe: number | null, aerTrainingEffect: number | null): VerdictTone {
  if ((rpe !== null && rpe >= 8) || (aerTrainingEffect !== null && aerTrainingEffect >= 4.8)) return 'caution'
  if ((rpe !== null && rpe <= 4) || (aerTrainingEffect !== null && aerTrainingEffect >= 3)) return 'positive'
  return 'neutral'
}
