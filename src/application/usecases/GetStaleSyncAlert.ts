import { getLastSyncedAt } from './GetSyncStatus'
import {
  getLastStaleSyncState,
  saveLastStaleSyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'

const STALE_SYNC_HOURS = 72

export interface StaleSyncAlert {
  hoursSinceSync: number
}

// Fires once when sync falls behind, then resets once a fresh sync lands so a later gap re-alerts.
export async function getStaleSyncAlert(): Promise<StaleSyncAlert | null> {
  const lastSyncedAt = getLastSyncedAt()
  if (!lastSyncedAt) return null

  const hoursSinceSync = (Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000
  const isStale = hoursSinceSync >= STALE_SYNC_HOURS

  const lastState = await getLastStaleSyncState()
  const wasAlerted = lastState?.alerted ?? false

  await saveLastStaleSyncState({ alerted: isStale })

  if (!isStale || wasAlerted) return null
  return { hoursSinceSync: Math.round(hoursSinceSync) }
}
