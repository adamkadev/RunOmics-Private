import type { Activity } from '@/domain/activity/types'
import type { WorkoutPrescription } from '@/domain/coaching/types'
import { readControlledSession, type ControlledSessionReading } from './autoregulation'
import { CONTROLLED_THRESHOLD } from './controlledThreshold'

export interface ControlledRunView {
  reading: ControlledSessionReading
  windowStartSeconds: number
}

/** The run read as autoregulate reads it, so the page and the terminal agree on its verdict. */
export function controlledRunView(activity: Activity, session: WorkoutPrescription | null): ControlledRunView | null {
  const reading = session ? readControlledSession(activity, session) : null
  return reading ? { reading, windowStartSeconds: CONTROLLED_THRESHOLD.autoregulation.windowStartSeconds } : null
}
