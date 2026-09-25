import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import { getLastPrState, saveLastPrState, type PrState } from '@/infrastructure/repositories/FirestoreConfigRepository'
import { computeBestEfforts, EFFORTS } from './GetRecords'

export interface NewPr {
  key: string
  label: string
  seconds: number
  activityId: string
  date: string
}

/**
 * Nothing is stored until `commit()`: the caller sends the pushes first and
 * commits once they are out, so a failed push is offered again next run
 * instead of being marked as sent.
 */
export async function getNewPrs(): Promise<{ newPrs: NewPr[]; commit: () => Promise<void> }> {
  const activities = getAllActivities()
  const computed = computeBestEfforts(activities)
  const lastState = await getLastPrState()

  const newPrs: NewPr[] = []
  const nextState: PrState = {}

  for (const { key, label } of EFFORTS) {
    const entry = computed.get(key)
    if (!entry) continue

    const seconds = Math.round(entry.seconds)
    nextState[key] = { seconds, activityId: entry.activityId }

    const previous = lastState?.[key]
    if (lastState && previous && seconds < previous.seconds) {
      newPrs.push({ key, label, seconds, activityId: entry.activityId, date: entry.date })
    }
  }

  return { newPrs, commit: () => saveLastPrState(nextState) }
}
