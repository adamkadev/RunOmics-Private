import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/ownerRoute'
import { isSitePrivate } from '@/lib/siteAccess'

/**
 * Who may spend the routing key (owner decision, Oct 2026).
 *
 * On a private site the proxy (src/proxy.ts) has already turned away every
 * request without the owner's or an invited viewer's session, so whoever
 * got here may generate loops - the other athlete included. Asked through
 * the same `isSitePrivate` the proxy asks, so the two can never disagree on
 * whether the gate is up.
 *
 * On a public site nothing stands in front of this route, and an open proxy
 * would hand the day's quota to anyone who found it: the owner's Firebase
 * token is required, as for the Sync button.
 */

export type ExploreCaller = { ok: true; key: string } | { ok: false; response: NextResponse }

/**
 * The caller's address, for counting requests only - never logged. Vercel
 * sets x-forwarded-for itself, so its first entry is the client's.
 */
export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    'unknown'
  )
}

/**
 * The rate-limit key comes with the answer. The owner is one person on every
 * device, so one key: `requireOwner` vouches for the claim, not for a uid. A
 * private site's visitors are counted by address.
 */
export async function authorizeExploreCaller(req: NextRequest): Promise<ExploreCaller> {
  if (isSitePrivate(process.env)) return { ok: true, key: `ip:${clientIp(req)}` }

  const denied = await requireOwner(req)
  if (denied) return { ok: false, response: denied }
  return { ok: true, key: 'owner' }
}
