import { NextResponse, type NextRequest } from 'next/server'
import { handleOwnerRoute } from '@/lib/ownerRoute'
import { parseSince, verdictStatus } from '@/lib/verdictStatus'

/**
 * The owner-authenticated twin of `/api/internal/latest-verdict`: same answer,
 * reached with the Firebase ID token the browser already holds instead of the
 * shared secret only the sync workflow may carry.
 */
export async function GET(req: NextRequest) {
  return handleOwnerRoute('sync-status', req, async () => {
    const since = parseSince(req.nextUrl.searchParams.get('since'))
    if (since === 'invalid') {
      return NextResponse.json({ error: 'since must be an ISO 8601 timestamp' }, { status: 400 })
    }

    return NextResponse.json(await verdictStatus(req.nextUrl.origin, since))
  })
}
