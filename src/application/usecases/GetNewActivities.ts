import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import {
  getLastActivitySyncState,
  saveLastActivitySyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { Activity } from '@/domain/activity/types'

// Bounds the Firestore doc size - genuinely new activities are always near the
// top of getAllActivities() (sorted newest-first), so tracking older ones is unnecessary.
const TRACKED_WINDOW = 60

// Returns [] on the very first call (nothing to compare against yet) - it just bootstraps the stored state.
export async function getNewActivities(): Promise<Activity[]> {
  const activities = getAllActivities().slice(0, TRACKED_WINDOW)
  const lastState = await getLastActivitySyncState()

  const newActivities = lastState ? activities.filter((a) => !lastState.knownIds.includes(a.id)) : []

  await saveLastActivitySyncState({ knownIds: activities.map((a) => a.id) })
  return newActivities
}
