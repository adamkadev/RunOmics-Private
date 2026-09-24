import { NextResponse, type NextRequest } from 'next/server'
import { logRejectedRequest } from '@/lib/internalAuth'
import { verifyFirebaseIdToken } from '@/lib/verifyFirebaseIdToken'

/**
 * The browser-side counterpart to `guardInternalRequest`.
 *
 * `/api/internal/*` is called by the sync workflow, which carries a shared
 * secret no browser may ever hold. A route the owner's own phone calls needs
 * the other half: the Firebase ID token behind `useOwnerAuth`, verified here
 * against the same `owner` custom claim `firestore.rules` enforces, so the
 * answer to "is this the owner" is the one claim set once by
 * `npm run set-owner-claim` rather than a second notion of who is privileged.
 *
 * Verified by hand rather than through firebase-admin/auth - see
 * verifyFirebaseIdToken for why that import broke this route in production.
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
    // A revoked, expired or forged token all land here, and all mean the same
    // thing to the caller: sign in again. The log keeps to the same reason -
    // the verifier's message can quote the expected audience.
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
