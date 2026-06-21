import type { NextRequest } from 'next/server'

export function isAuthorizedInternalRequest(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_NOTIFY_SECRET
  if (!secret) return false
  return req.headers.get('x-internal-secret') === secret
}
