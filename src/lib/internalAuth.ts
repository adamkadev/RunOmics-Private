import 'server-only'
import { timingSafeEqual } from 'crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { clientIp, createRateLimiter } from '@/lib/rateLimit'

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

/** Scoped to /api/internal/ops-push: the other deployment holds this secret, never the master internal one. */
export function isAuthorizedOpsRequest(req: NextRequest): boolean {
  return matchesSecret(req.headers.get('x-ops-secret'), process.env.OPS_PUSH_SECRET)
}

/** Vercel Cron sends CRON_SECRET as a bearer token and cannot send any other header. */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  return matchesSecret(req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1], process.env.CRON_SECRET)
}

const limiter = createRateLimiter({ max: 20, windowMs: 60_000, maxKeys: 1000 })

export type RejectionReason = 'unauthorized' | 'rate-limited' | 'forbidden' | 'not-configured'

/** Which route and why, never who or with what: no header value (secret, token, forwarded IP) reaches the log. */
export function logRejectedRequest(req: NextRequest, reason: RejectionReason): void {
  console.warn(JSON.stringify({ level: 'warn', event: 'request-rejected', route: req.nextUrl.pathname, reason }))
}

export function guardInternalRequest(req: NextRequest, authorize: InternalAuthorizer = isAuthorizedInternalRequest): NextResponse | null {
  if (!limiter.take(clientIp(req), Date.now()).ok) {
    logRejectedRequest(req, 'rate-limited')
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }
  if (!authorize(req)) {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
