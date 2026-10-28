import { NextResponse, type NextRequest } from 'next/server'
import { handleInternalRoute } from '@/lib/internalRoute'
import { opsStrings, sendOpsPush } from '@/lib/opsPush'
import { pushPaths } from '@/lib/pushLinks'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Called by the sync the night GARMIN_SECRET is found expired, once. Body: `{ "since": "YYYY-MM-DD" }`. */
export async function POST(req: NextRequest) {
  return handleInternalRoute('connect-expired', req, async () => {
    const body: unknown = await req.json().catch(() => undefined)
    const since = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).since : undefined
    if (typeof since !== 'string' || !ISO_DATE.test(since) || Number.isNaN(Date.parse(since))) {
      return NextResponse.json({ error: 'since must be a YYYY-MM-DD date' }, { status: 400 })
    }

    const n = opsStrings.connectExpired
    await sendOpsPush({ title: n.title, body: n.body(since), link: pushPaths.settings, tag: 'connect-expired' })
    return NextResponse.json({ sent: true })
  })
}
