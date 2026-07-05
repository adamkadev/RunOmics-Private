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
