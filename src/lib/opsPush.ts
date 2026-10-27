import 'server-only'
import { en } from '@/i18n/en'
import { withTimeout } from '@/lib/withTimeout'
import { absolutePushLink } from './pushLinks'
import { sendPush, type Push } from './sendPushNotification'

/** Operator alerts are read by whoever runs the deployment, who is not always the athlete: English, whatever the locale. */
export const opsStrings = en.notifications

const FORWARD_TIMEOUT_MS = 10_000

export interface OpsPushResult {
  forwarded: boolean
}

interface Forwarding {
  url: string
  secret: string
}

export function opsForwarding(): Forwarding | null {
  const url = process.env.OPS_PUSH_URL?.trim()
  const secret = process.env.OPS_PUSH_SECRET?.trim()
  return url && secret ? { url, secret } : null
}

/**
 * Which deployment raised the alert, so two never read alike on one phone. The
 * sync profile and not the athlete's name: an alert about a workspace that
 * will not load must not itself need that workspace to say who it is about.
 */
export function opsSource(): string {
  return process.env.GITHUB_SYNC_PROFILE?.trim() || 'RunOmics'
}

/**
 * The operator's own devices, which on a second athlete's deployment are not
 * the ones registered here: with OPS_PUSH_URL set the alert is forwarded to
 * the operator's deployment instead of pushed locally.
 */
export async function sendOpsPush(push: Push): Promise<OpsPushResult> {
  const { title, body, tag } = push
  const forwarding = opsForwarding()
  if (!forwarding) {
    await sendPush('always', push)
    return { forwarded: false }
  }

  const response = await withTimeout(
    fetch(forwarding.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-ops-secret': forwarding.secret },
      body: JSON.stringify({ title, body, from: opsSource(), link: absolutePushLink(push.link), tag }),
    }),
    FORWARD_TIMEOUT_MS,
    null,
  )

  if (!response) throw new Error(`Operator alert "${title}" timed out on its way to the operator's deployment`)
  if (!response.ok) throw new Error(`Operator alert "${title}" was refused by the operator's deployment: ${response.status}`)
  return { forwarded: true }
}
