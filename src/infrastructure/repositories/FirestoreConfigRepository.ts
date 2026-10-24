import type { DocumentData } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebase-admin'

function notificationDocument<T extends DocumentData>(documentId: string) {
  const document = () => getAdminFirestore().collection('notifications').doc(documentId)

  // Arrow properties, because every caller below detaches them from this object.
  return {
    read: async (): Promise<T | null> => {
      const snapshot = await document().get()
      return snapshot.exists ? (snapshot.data() as T) : null
    },
    write: async (state: T): Promise<void> => {
      await document().set(state)
    },
  }
}

export type PrState = Record<string, { seconds: number; activityId: string }>

export type ShoeWearState = Record<string, { alerted: boolean }>

// Type aliases, not interfaces: only an alias gets the implicit index signature Firestore's DocumentData needs.
export type OverreachingState = { alerted: boolean }

export type StaleSyncState = { alerted: boolean }

export type ActivitySyncState = { knownIds: string[] }

export type ExploreMilestoneState = { areaId: string; announced: string[] }

export type ClientErrorAlertState = { lastAt: string }

export const { read: getLastPrState, write: saveLastPrState } =
  notificationDocument<PrState>('lastPrs')

export const { read: getLastShoeWearState, write: saveLastShoeWearState } =
  notificationDocument<ShoeWearState>('lastShoeWear')

export const { read: getLastOverreachingState, write: saveLastOverreachingState } =
  notificationDocument<OverreachingState>('lastOverreaching')

export const { read: getLastStaleSyncState, write: saveLastStaleSyncState } =
  notificationDocument<StaleSyncState>('lastStaleSync')

export const { read: getLastActivitySyncState, write: saveLastActivitySyncState } =
  notificationDocument<ActivitySyncState>('lastActivitySync')

export const { read: getLastExploreMilestoneState, write: saveLastExploreMilestoneState } =
  notificationDocument<ExploreMilestoneState>('lastExploreMilestones')

export const { read: getLastClientErrorAlertState, write: saveLastClientErrorAlertState } =
  notificationDocument<ClientErrorAlertState>('lastClientErrors')
