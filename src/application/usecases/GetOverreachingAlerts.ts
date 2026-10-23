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
 * Nothing is stored until `commit()`: commit once the pushes are out, so a
 * failed push is offered again next run.
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
