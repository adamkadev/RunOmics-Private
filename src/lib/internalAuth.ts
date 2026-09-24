import 'server-only'
import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'

export function isAuthorizedInternalRequest(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_NOTIFY_SECRET
  const provided = req.headers.get('x-internal-secret')
  if (!secret || !provided) return false

  const secretBuf = Buffer.from(secret)
  const providedBuf = Buffer.from(provided)
  if (secretBuf.length !== providedBuf.length) return false

  return timingSafeEqual(secretBuf, providedBuf)
}

const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

const hits = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    if (hits.size > 1000) {
      for (const [key, value] of hits) {
        if (now - value.windowStart >= RATE_LIMIT_WINDOW_MS) hits.delete(key)
      }
    }
    hits.set(ip, { count: 1, windowStart: now })
    return false
  }
  entry.count += 1
  return entry.count > RATE_LIMIT_MAX
}

export type RejectionReason = 'unauthorized' | 'rate-limited' | 'forbidden' | 'not-configured'

/**
 * One line per refused request: which route and why, never who or with what.
 * No header value - the secret, a token, the forwarded IP - reaches the log.
 * A run of these is what a guessed secret, a stale one left in a workflow or
 * the Shortcut, or a deployment missing its config looks like, and none of
 * that used to leave a trace.
 */
export function logRejectedRequest(req: NextRequest, reason: RejectionReason): void {
  console.warn(JSON.stringify({ level: 'warn', event: 'request-rejected', route: req.nextUrl.pathname, reason }))
}

export function guardInternalRequest(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    logRejectedRequest(req, 'rate-limited')
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  if (!isAuthorizedInternalRequest(req)) {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
