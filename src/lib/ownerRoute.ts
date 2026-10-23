import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { logRejectedRequest } from '@/lib/internalAuth'
import { verifyFirebaseIdToken } from '@/lib/verifyFirebaseIdToken'

/**
 * Checks the same `owner` custom claim firestore.rules enforces. Verified by
 * hand, not through firebase-admin/auth: see verifyFirebaseIdToken.
 */
export async function requireOwner(req: NextRequest): Promise<NextResponse | null> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    logRejectedRequest(req, 'not-configured')
    return NextResponse.json({ error: 'Auth is not configured' }, { status: 503 })
  }

  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) {
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const claims = await verifyFirebaseIdToken(token, projectId)
    if (claims.owner !== true) {
      logRejectedRequest(req, 'forbidden')
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return null
  } catch {
    // The log keeps to the reason: the verifier's message can quote the expected audience.
    logRejectedRequest(req, 'unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

export async function handleOwnerRoute(
  name: string,
  req: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const denied = await requireOwner(req)
  if (denied) return denied

  try {
    return await handler()
  } catch (error) {
    console.error(`[owner:${name}]`, error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
