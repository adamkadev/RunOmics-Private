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

/**
 * Nothing is stored until `commit()`: the caller sends the pushes first and
 * commits once they are out, so a failed push is offered again next run
 * instead of being marked as sent.
 */
export async function getOverreachingAlerts(): Promise<{ newAlerts: OverreachingAlert[]; commit: () => Promise<void> }> {
  const status = await getTrainingStatus()
  if (!status) return { newAlerts: [], commit: async () => {} }

  const lastState = await getLastOverreachingState()
  const wasAlerted = lastState?.alerted ?? false
  const isHighRisk = status.risk === 'high'

  return {
    newAlerts: isHighRisk && !wasAlerted ? [{ tsb: status.tsb, acwr: status.acwr, ctlDelta: status.ctlDelta }] : [],
    commit: () => saveLastOverreachingState({ alerted: isHighRisk }),
  }
}
