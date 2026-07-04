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

// Fixed-window rate limit, keyed by client IP. In-memory, so on serverless
// each warm instance counts separately - good enough to blunt secret
// brute-forcing and push-notification floods, which is all these endpoints
// need (they are hit a few times a day by GitHub Actions crons).
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MS = 60_000

const hits = new Map<string, { count: number; windowStart: number }>()

function isRateLimited(ip: string, now = Date.now()): boolean {
  const entry = hits.get(ip)
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Also prune stale entries opportunistically so the map can't grow forever.
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

/**
 * Single guard for /api/internal/* routes: rate limit first (so failed auth
 * attempts are throttled too), then the shared-secret check. Returns the
 * error response to send, or null when the request may proceed.
 */
export function guardInternalRequest(req: NextRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  if (!isAuthorizedInternalRequest(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
