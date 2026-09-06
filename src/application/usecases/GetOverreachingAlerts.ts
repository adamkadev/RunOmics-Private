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
