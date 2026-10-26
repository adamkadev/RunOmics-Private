import 'server-only'
import { getMessaging } from 'firebase-admin/messaging'
import { getAdminApp, getAdminFirestore } from '@/lib/firebase-admin'
import { wantsPush, type PushAudience } from '@/lib/pushCategories'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])

export interface PushResult {
  sent: number
  failed: number
}

/** Throws when no device took the push: FCM resolves on per-token failures, and callers record a resolved push as sent. */
export async function sendPush(audience: PushAudience, title: string, body: string): Promise<PushResult> {
  const db = getAdminFirestore()
  const snapshot = await db.collection(PUSH_TOKENS_COLLECTION).get()
  const tokens = snapshot.docs.filter((d) => wantsPush(d.get('categories'), audience)).map((d) => d.id)
  if (tokens.length === 0) return { sent: 0, failed: 0 }

  const { responses } = await getMessaging(getAdminApp()).sendEachForMulticast({
    tokens,
    notification: { title, body },
  })

  const failures = tokens.flatMap((token, i) =>
    responses[i]?.success ? [] : [{ token, code: responses[i]?.error?.code ?? 'unknown' }]
  )
  const sent = tokens.length - failures.length
  const codes = failures.map(({ code }) => code).join(', ')
  if (failures.length) console.warn(`[push] ${failures.length} of ${tokens.length} devices refused "${title}": ${codes}`)

  const deadTokens = failures.filter(({ code }) => DEAD_TOKEN_CODES.has(code)).map(({ token }) => token)
  await Promise.all(deadTokens.map((token) => db.collection(PUSH_TOKENS_COLLECTION).doc(token).delete()))

  if (sent === 0) throw new Error(`Push "${title}" reached none of ${tokens.length} devices: ${codes}`)
  return { sent, failed: failures.length }
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
