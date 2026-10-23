import { getAllActivities } from '@/infrastructure/repositories/JsonActivityRepository'
import {
  getLastActivitySyncState,
  saveLastActivitySyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'
import type { Activity } from '@/domain/activity/types'

const TRACKED_WINDOW = 60

/**
 * Nothing is stored until `commit()`: commit once the pushes are out, so a
 * failed push is offered again next run.
 */
export async function getNewActivities(): Promise<{ newActivities: Activity[]; commit: () => Promise<void> }> {
  const activities = getAllActivities().slice(0, TRACKED_WINDOW)
  const lastState = await getLastActivitySyncState()

  const newActivities = lastState ? activities.filter((a) => !lastState.knownIds.includes(a.id)) : []

  return { newActivities, commit: () => saveLastActivitySyncState({ knownIds: activities.map((a) => a.id) }) }
}
