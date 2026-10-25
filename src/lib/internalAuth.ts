import 'server-only'
import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'

function matchesSecret(provided: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || !provided) return false

  const secretBuf = Buffer.from(secret)
  const providedBuf = Buffer.from(provided)
  if (secretBuf.length !== providedBuf.length) return false

  return timingSafeEqual(secretBuf, providedBuf)
}

export type InternalAuthorizer = (req: NextRequest) => boolean

export function isAuthorizedInternalRequest(req: NextRequest): boolean {
  return matchesSecret(req.headers.get('x-internal-secret'), process.env.INTERNAL_NOTIFY_SECRET)
}

/** Vercel Cron sends CRON_SECRET as a bearer token and cannot send any other header. */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  return matchesSecret(req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1], process.env.CRON_SECRET)
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

/** Which route and why, never who or with what: no header value (secret, token, forwarded IP) reaches the log. */
export function logRejectedRequest(req: NextRequest, reason: RejectionReason): void {
  console.warn(JSON.stringify({ level: 'warn', event: 'request-rejected', route: req.nextUrl.pathname, reason }))
}

export function guardInternalRequest(req: NextRequest, authorize: InternalAuthorizer = isAuthorizedInternalRequest): NextResponse | null {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    logRejectedRequest(req, 'rate-limited')
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  if (!authorize(req)) {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
