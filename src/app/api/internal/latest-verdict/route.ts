import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { parseSince, verdictStatus } from '@/lib/verdictStatus'

/**
 * What the iOS shortcut polls while it waits for a freshly synced run to get
 * its AI verdict. See docs/ios-shortcut.md. The Sync button in Settings asks
 * the same question through `/api/sync/status`, which is owner-authenticated
 * rather than secret-guarded; both answer from `verdictStatus`.
 */
export async function GET(req: NextRequest) {
  return handleInternalRoute('latest-verdict', req, async () => {
    const since = parseSince(req.nextUrl.searchParams.get('since'))
    if (since === 'invalid') {
      return NextResponse.json({ error: 'since must be an ISO 8601 timestamp' }, { status: 400 })
    }

    return NextResponse.json(await verdictStatus(req.nextUrl.origin, since))
  })
}
