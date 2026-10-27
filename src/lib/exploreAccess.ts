import 'server-only'
import type { NextRequest, NextResponse } from 'next/server'
import { requireOwner } from '@/lib/ownerRoute'
import { clientIp } from '@/lib/rateLimit'
import { isSitePrivate } from '@/lib/siteAccess'

/**
 * On a private site the proxy (src/proxy.ts) has already turned away every
 * caller without a session, so anyone here may spend the routing key. On a
 * public site an open proxy would hand the day's quota to anyone, so the
 * owner's token is required.
 */

export type ExploreCaller = { ok: true; key: string } | { ok: false; response: NextResponse }

/** The owner is one person on every device, so one key: `requireOwner` vouches for the claim, not for a uid. */
export async function authorizeExploreCaller(req: NextRequest): Promise<ExploreCaller> {
  if (isSitePrivate(process.env)) return { ok: true, key: `ip:${clientIp(req)}` }

  const denied = await requireOwner(req)
  if (denied) return { ok: false, response: denied }
  return { ok: true, key: 'owner' }
}
