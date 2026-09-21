import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import {
  getLastActivitySyncState,
  saveLastActivitySyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { Activity } from '@/domain/activity/types'

const TRACKED_WINDOW = 60

export async function getNewActivities(): Promise<Activity[]> {
  const activities = getAllActivities().slice(0, TRACKED_WINDOW)
  const lastState = await getLastActivitySyncState()

  const newActivities = lastState ? activities.filter((a) => !lastState.knownIds.includes(a.id)) : []

  await saveLastActivitySyncState({ knownIds: activities.map((a) => a.id) })
  return newActivities
}
