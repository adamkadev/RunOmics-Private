import { getMessaging } from 'firebase-admin/messaging'
import { getAdminApp, getAdminFirestore } from '@/lib/firebase-admin'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

export async function sendPushToAllDevices(title: string, body: string): Promise<void> {
  const db = getAdminFirestore()
  const snapshot = await db.collection(PUSH_TOKENS_COLLECTION).get()
  const tokens = snapshot.docs.map((d) => d.id)
  if (tokens.length === 0) return

  const response = await getMessaging(getAdminApp()).sendEachForMulticast({
    tokens,
    notification: { title, body },
  })

  const staleTokens = tokens.filter((_, i) => {
    const res = response.responses[i]
    return res && !res.success && res.error?.code === 'messaging/registration-token-not-registered'
  })
  await Promise.all(staleTokens.map((token) => db.collection(PUSH_TOKENS_COLLECTION).doc(token).delete()))
}

export interface Push {
  title: string
  body: string
}

/**
 * Every push in the batch is tried, even past one that failed, and the
 * failure is thrown only once all of them have been: a transient FCM error on
 * the first of three alerts must not cost the other two. A caller holding
 * dedup state commits it after this returns, so a failure offers the whole
 * batch again next run.
 */
export async function sendPushesToAllDevices(pushes: Push[]): Promise<void> {
  const failures: unknown[] = []

  for (const { title, body } of pushes) {
    try {
      await sendPushToAllDevices(title, body)
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length) throw new AggregateError(failures, `${failures.length} of ${pushes.length} pushes failed`)
}
