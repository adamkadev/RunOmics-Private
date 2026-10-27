import { getLastSyncedAt } from './GetSyncStatus'
import { hoursSinceSync, STALE_SYNC_HOURS } from '@/domain/sync/staleness'
import {
  getLastStaleSyncState,
  saveLastStaleSyncState,
} from '@/infrastructure/repositories/FirestoreConfigRepository'

export interface StaleSyncAlert {
  hoursSinceSync: number
}

/**
 * Nothing is stored until `commit()`: commit once the pushes are out, so a
 * failed push is offered again next run.
 */
export async function getStaleSyncAlert(): Promise<{ alert: StaleSyncAlert | null; commit: () => Promise<void> }> {
  const lastSyncedAt = getLastSyncedAt()
  if (!lastSyncedAt) return { alert: null, commit: async () => {} }

  const hours = hoursSinceSync(lastSyncedAt, Date.now())
  const isStale = hours >= STALE_SYNC_HOURS

  const lastState = await getLastStaleSyncState()
  const wasAlerted = lastState?.alerted ?? false

  return {
    alert: isStale && !wasAlerted ? { hoursSinceSync: Math.round(hours) } : null,
    commit: () => saveLastStaleSyncState({ alerted: isStale }),
  }
}
