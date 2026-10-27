import 'server-only'
import { getMessaging } from 'firebase-admin/messaging'
import { getAdminApp, getAdminFirestore } from '@/lib/firebase-admin'
import { wantsPush, type PushAudience } from '@/lib/pushCategories'
import { absolutePushLink } from '@/lib/pushLinks'

const PUSH_TOKENS_COLLECTION = 'pushTokens'

const DEAD_TOKEN_CODES = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'])

/** FCM expires a token its app has not refreshed in 270 days; the app re-saves a live one monthly. */
export const STALE_TOKEN_MS = 270 * 24 * 60 * 60 * 1000

/** A document saved before `updatedAt` existed has none, and is kept. */
function isStaleToken(updatedAt: unknown, now: number): boolean {
  const millis = (updatedAt as { toMillis?: () => number } | undefined)?.toMillis?.()
  return typeof millis === 'number' && now - millis > STALE_TOKEN_MS
}

export interface Push {
  title: string
  body: string
  /** A path on this deployment or an absolute HTTPS URL, opened when the notification is tapped. */
  link?: string
  /** A later push with the same tag replaces this one on the device instead of stacking under it. */
  tag?: string
}

export interface PushResult {
  sent: number
  failed: number
}

/** Throws when no device took the push: FCM resolves on per-token failures, and callers record a resolved push as sent. */
export async function sendPush(audience: PushAudience, { title, body, link, tag }: Push): Promise<PushResult> {
  const db = getAdminFirestore()
  const snapshot = await db.collection(PUSH_TOKENS_COLLECTION).get()
  const now = Date.now()
  const stale = snapshot.docs.filter((d) => isStaleToken(d.get('updatedAt'), now))
  await Promise.all(stale.map((d) => d.ref.delete()))
  const tokens = snapshot.docs
    .filter((d) => !stale.includes(d) && wantsPush(d.get('categories'), audience))
    .map((d) => d.id)
  if (tokens.length === 0) return { sent: 0, failed: 0 }

  const absoluteLink = absolutePushLink(link)
  const { responses } = await getMessaging(getAdminApp()).sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      ...(tag ? { notification: { tag } } : {}),
      ...(absoluteLink ? { fcmOptions: { link: absoluteLink } } : {}),
    },
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

/** Throws only once every push was tried: one transient FCM error must not cost the alerts queued behind it. */
export async function sendPushes(audience: PushAudience, pushes: Push[]): Promise<void> {
  const failures: unknown[] = []

  for (const push of pushes) {
    try {
      await sendPush(audience, push)
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length) throw new AggregateError(failures, `${failures.length} of ${pushes.length} pushes failed`)
}
