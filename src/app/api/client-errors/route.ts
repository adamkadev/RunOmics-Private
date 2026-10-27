import { NextResponse, type NextRequest } from 'next/server'
import { listClientErrors, recordClientError } from '@/application/usecases/ClientErrors'
import { logRejectedRequest } from '@/lib/internalAuth'
import { requireOwner } from '@/lib/ownerRoute'
import { clientIp, createRateLimiter } from '@/lib/rateLimit'

const NO_STORE = { 'Cache-Control': 'private, no-store' }
/** A page caught in a loop of errors stops here, not in Firestore. */
const limiter = createRateLimiter({ max: 20, windowMs: 60_000, maxKeys: 1000 })
const MAX_BODY = 4_000

export async function POST(req: NextRequest) {
  if (!limiter.take(clientIp(req), Date.now()).ok) {
    logRejectedRequest(req, 'rate-limited')
    return new NextResponse(null, { status: 429, headers: NO_STORE })
  }
  const raw = await req.text().catch(() => '')
  if (raw.length > MAX_BODY) return new NextResponse(null, { status: 413, headers: NO_STORE })
  let body: unknown = null
  try {
    body = JSON.parse(raw)
  } catch {
    return new NextResponse(null, { status: 400, headers: NO_STORE })
  }
  try {
    const report = await recordClientError(body)
    return new NextResponse(null, { status: report ? 204 : 400, headers: NO_STORE })
  } catch (error) {
    console.error('[client-error] could not keep a report:', error)
    return new NextResponse(null, { status: 500, headers: NO_STORE })
  }
}

export async function GET(req: NextRequest) {
  const denied = await requireOwner(req)
  if (denied) return denied
  return NextResponse.json({ errors: await listClientErrors() }, { headers: NO_STORE })
}
