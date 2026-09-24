import { getLastSyncedAt } from './GetSyncStatus'
import {
  getLastStaleSyncState,
  saveLastStaleSyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'

const STALE_SYNC_HOURS = 72

export interface StaleSyncAlert {
  hoursSinceSync: number
}

/**
 * Nothing is stored until `commit()`: the caller sends the pushes first and
 * commits once they are out, so a failed push is offered again next run
 * instead of being marked as sent.
 */
export async function getStaleSyncAlert(): Promise<{ alert: StaleSyncAlert | null; commit: () => Promise<void> }> {
  const lastSyncedAt = getLastSyncedAt()
  if (!lastSyncedAt) return { alert: null, commit: async () => {} }

  const hoursSinceSync = (Date.now() - new Date(lastSyncedAt).getTime()) / 3_600_000
  const isStale = hoursSinceSync >= STALE_SYNC_HOURS

  const lastState = await getLastStaleSyncState()
  const wasAlerted = lastState?.alerted ?? false

  return {
    alert: isStale && !wasAlerted ? { hoursSinceSync: Math.round(hoursSinceSync) } : null,
    commit: () => saveLastStaleSyncState({ alerted: isStale }),
  }
}
