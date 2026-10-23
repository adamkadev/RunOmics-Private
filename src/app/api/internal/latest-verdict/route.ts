import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { parseSince, verdictStatus } from '@/lib/verdictStatus'
import { loadData } from '@/application/usecases/LoadData'

/** Secret-guarded for the iOS shortcut; Settings asks the same through the owner-authenticated `/api/sync/status`. */
export async function GET(req: NextRequest) {
  return handleInternalRoute('latest-verdict', req, async () => {
    await loadData()
    const since = parseSince(req.nextUrl.searchParams.get('since'))
    if (since === 'invalid') {
      return NextResponse.json({ error: 'since must be an ISO 8601 timestamp' }, { status: 400 })
    }

    return NextResponse.json(await verdictStatus(req.nextUrl.origin, since))
  })
}
