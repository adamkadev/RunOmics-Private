import { getTrainingStatus } from './GetTrainingStatus'
import {
  getLastOverreachingState,
  saveLastOverreachingState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'

export interface OverreachingAlert {
  tsb: number
  acwr: number | null
  ctlDelta: number
}

// Fires once on the transition into risk=high, then resets once risk drops below high
// so a later relapse re-alerts. Returns [] on the very first call (bootstraps the stored state).
export async function getOverreachingAlerts(): Promise<OverreachingAlert[]> {
  const status = await getTrainingStatus()
  if (!status) return []

  const lastState = await getLastOverreachingState()
  const wasAlerted = lastState?.alerted ?? false
  const isHighRisk = status.risk === 'high'

  await saveLastOverreachingState({ alerted: isHighRisk })

  if (!isHighRisk || wasAlerted) return []

  return [{ tsb: status.tsb, acwr: status.acwr, ctlDelta: status.ctlDelta }]
}
