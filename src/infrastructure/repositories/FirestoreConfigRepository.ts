import type { DocumentData } from 'firebase-admin/firestore'
import { getAdminFirestore } from '@/lib/firebase-admin'

/**
 * The dedup state behind the notification crons.
 *
 * Every one of these is the same document: one small object under
 * `notifications/`, read once and written once by the single cron route that
 * owns it, so that "you set a PR" or "this shoe is worn out" is said once and
 * not again on the next pass. They were five hand-written `get`/`save` pairs
 * differing only in a document id and a type - the fifth was added by copying
 * the fourth - which is five places for one collection name to drift and five
 * places to fix when the read wants an error path.
 *
 * The exported names are unchanged on purpose: they read as what the caller
 * wants, and the use cases and their tests already mock this module by name.
 */
function notificationState<T extends DocumentData>(documentId: string) {
  const document = () => getAdminFirestore().collection('notifications').doc(documentId)

  return {
    async read(): Promise<T | null> {
      const snapshot = await document().get()
      return snapshot.exists ? (snapshot.data() as T) : null
    },
    async write(state: T): Promise<void> {
      await document().set(state)
    },
  }
}

export type PrState = Record<string, { seconds: number; activityId: string }>

export type ShoeWearState = Record<string, { alerted: boolean }>

// Written as type aliases rather than interfaces so they satisfy Firestore's
// DocumentData constraint: TypeScript gives an object type alias an implicit
// index signature and an interface none.
export type OverreachingState = { alerted: boolean }

export type StaleSyncState = { alerted: boolean }

export type ActivitySyncState = { knownIds: string[] }

const prs = notificationState<PrState>('lastPrs')
const shoeWear = notificationState<ShoeWearState>('lastShoeWear')
const overreaching = notificationState<OverreachingState>('lastOverreaching')
const staleSync = notificationState<StaleSyncState>('lastStaleSync')
const activitySync = notificationState<ActivitySyncState>('lastActivitySync')

export const getLastPrState = prs.read
export const saveLastPrState = prs.write

export const getLastShoeWearState = shoeWear.read
export const saveLastShoeWearState = shoeWear.write

export const getLastOverreachingState = overreaching.read
export const saveLastOverreachingState = overreaching.write

export const getLastStaleSyncState = staleSync.read
export const saveLastStaleSyncState = staleSync.write

export const getLastActivitySyncState = activitySync.read
export const saveLastActivitySyncState = activitySync.write
