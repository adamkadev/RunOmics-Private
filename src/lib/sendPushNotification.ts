import 'server-only'
import { getMessaging } from 'firebase-admin/messaging'
import { getAdminApp, getAdminFirestore } from '@/lib/firebase-admin'
import { wantsPush, type PushAudience } from '@/lib/pushCategories'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

export async function sendPush(audience: PushAudience, title: string, body: string): Promise<void> {
  const db = getAdminFirestore()
  const snapshot = await db.collection(PUSH_TOKENS_COLLECTION).get()
  const tokens = snapshot.docs.filter((d) => wantsPush(d.get('categories'), audience)).map((d) => d.id)
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

/** Throws only once every push was tried: one transient FCM error must not cost the alerts queued behind it. */
export async function sendPushes(audience: PushAudience, pushes: Push[]): Promise<void> {
  const failures: unknown[] = []

  for (const { title, body } of pushes) {
    try {
      await sendPush(audience, title, body)
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length) throw new AggregateError(failures, `${failures.length} of ${pushes.length} pushes failed`)
}
