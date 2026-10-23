import { createHash } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { handleOwnerRoute } from '@/lib/ownerRoute'
import { parseSince, verdictStatus } from '@/lib/verdictStatus'
import { loadData } from '@/application/usecases/LoadData'

/**
 * The owner-authenticated twin of `/api/internal/latest-verdict`, reached with the browser's Firebase ID token instead
 * of the shared secret only the sync workflow may carry.
 */
export async function GET(req: NextRequest) {
  return handleOwnerRoute('sync-status', req, async () => {
    await loadData()
    const since = parseSince(req.nextUrl.searchParams.get('since'))
    if (since === 'invalid') {
      return NextResponse.json({ error: 'since must be an ISO 8601 timestamp' }, { status: 400 })
    }

    // Tagged so a repeated answer is an empty 304: most of a sync's polls are "still going".
    const status = await verdictStatus(req.nextUrl.origin, since)
    const etag = `"${createHash('sha1').update(JSON.stringify(status)).digest('base64url')}"`
    if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers: { etag } })
    return NextResponse.json(status, { headers: { etag } })
  })
}
