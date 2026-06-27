import { timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'

export function isAuthorizedInternalRequest(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_NOTIFY_SECRET
  const provided = req.headers.get('x-internal-secret')
  if (!secret || !provided) return false

  const secretBuf = Buffer.from(secret)
  const providedBuf = Buffer.from(provided)
  if (secretBuf.length !== providedBuf.length) return false

  return timingSafeEqual(secretBuf, providedBuf)
}
