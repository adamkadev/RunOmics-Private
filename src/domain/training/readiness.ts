import type { TrainingStatus } from '@/application/usecases/GetTrainingStatus'

export type ReadinessTone = 'go' | 'caution' | 'hold'

export function verdictTone(status: TrainingStatus): ReadinessTone {
  const fatigueRising = status.atlDelta > 1
  const fatigueFalling = status.atlDelta < -1
  const tone: ReadinessTone =
    status.tsbNow < -10 || fatigueRising ? 'hold' : status.tsbNow > 5 && fatigueFalling ? 'go' : 'caution'

  if (status.status === 'overreaching') return 'hold'
  if (tone === 'go' && (status.status === 'unproductive' || status.status === 'detraining' || status.status === 'recovery')) {
    return 'caution'
  }
  return tone
}
