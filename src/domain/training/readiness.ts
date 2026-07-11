import type { TrainingStatusType, RiskLevel } from '@/application/usecases/GetTrainingStatus'

export type ReadinessTone = 'go' | 'caution' | 'hold'

// Tone follows the existing 5-way training status classification directly -
// overreaching is always a hold (classify() only reaches it via tsb < -30 or
// acwr > 1.5), fresh/productive read as go, recovery/detraining as caution.
export function readinessTone(status: TrainingStatusType, risk: RiskLevel): ReadinessTone {
  if (status === 'overreaching' || risk === 'high') return 'hold'
  if (status === 'fresh' || status === 'productive') return 'go'
  return 'caution'
}
